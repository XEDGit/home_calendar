import dns from 'dns/promises';
import http from 'http';
import https from 'https';
import net from 'net';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

// Internet access for the assistant: search through the internal SearXNG
// service, and read pages. fetchPage runs inside app-network, so every hop is
// checked against the SSRF rules below and connects to the exact address it
// validated (no second DNS lookup, so no rebinding in between).

const SEARXNG_URL = process.env.SEARXNG_URL || 'http://searxng:8080';
const PORTS = [80, 443];
const TIMEOUT_MS = 10000;
const MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_TEXT = 8000;
// Readability gives up (and we fall back to the whole page) past this many
// elements, so a huge or hostile page can't make parsing drag on.
const MAX_ELEMS = 20000;
const USER_AGENT = 'Mozilla/5.0 (compatible; HomeCalendarAssistant/1.0)';
const BLOCKED_SUFFIXES = ['.local', '.internal', '.lan', '.home', '.localhost'];
const TEXT_TYPES = /^(text\/|application\/(json|xml|xhtml\+xml)\b)/i;
const HTML_TYPES = /^(text\/html|application\/xhtml\+xml)\b/i;

export class WebError extends Error {}

// ── Address rules ───────────────────────────────────────────────────────────

const V4_BLOCKED = new net.BlockList();
for (const [addr, bits] of [
	['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
	['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
	['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) V4_BLOCKED.addSubnet(addr, bits, 'ipv4');

// "::ffff:1.2.3.4" / "fe80::1%eth0" → eight 16-bit words
function v6Words(ip) {
	let s = ip.split('%')[0].toLowerCase();
	const dotted = s.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
	if (dotted) {
		const [a, b, c, d] = dotted.slice(1).map(Number);
		s = s.slice(0, -dotted[0].length) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
	}
	const [head, tail] = s.split('::');
	const h = head ? head.split(':') : [];
	const t = tail === undefined ? [] : tail ? tail.split(':') : [];
	const fill = tail === undefined ? [] : Array(8 - h.length - t.length).fill('0');
	return [...h, ...fill, ...t].map((x) => parseInt(x, 16));
}

export function isPublicIp(ip) {
	const family = net.isIP(String(ip));
	if (family === 4) return !V4_BLOCKED.check(ip, 'ipv4');
	if (family !== 6) return false;
	const w = v6Words(ip);
	// IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d, also :: and ::1)
	if (w.slice(0, 5).every((x) => x === 0) && (w[5] === 0xffff || w[5] === 0)) {
		return !V4_BLOCKED.check([w[6] >> 8, w[6] & 255, w[7] >> 8, w[7] & 255].join('.'), 'ipv4');
	}
	// Only global unicast (2000::/3), minus documentation, Teredo and 6to4
	if ((w[0] & 0xe000) !== 0x2000) return false;
	if (w[0] === 0x2001 && (w[1] === 0x0db8 || w[1] === 0)) return false;
	if (w[0] === 0x2002) return false;
	return true;
}

export function checkUrl(raw, ports = PORTS) {
	let url;
	try { url = new URL(String(raw)); } catch { throw new WebError('invalid url'); }
	if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new WebError('blocked');
	if (url.username || url.password) throw new WebError('blocked');
	const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
	if (!ports.includes(port)) throw new WebError('blocked');
	const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
	if (!net.isIP(host) && (!host.includes('.') || host === 'localhost' || BLOCKED_SUFFIXES.some((s) => host.endsWith(s)))) {
		throw new WebError('blocked');
	}
	return { url, host, port };
}

// Rejects with `err` (unchanged) as soon as either `promise` settles or
// `signal` aborts — a DNS lookup has no timeout of its own, so without this a
// stuck resolver would hang fetchPage past its overall deadline.
// Exported only so tests can exercise the already-aborted fast path directly.
export function raceSignal(promise, signal) {
	if (signal.aborted) {
		// `promise` (e.g. a DNS lookup) was already started by the caller
		// before this was known to be pointless — if we don't touch it and
		// it later rejects, Node sees an unhandled rejection. Consume it.
		promise.catch(() => {});
		return Promise.reject(new Error('aborted'));
	}
	return new Promise((resolve, reject) => {
		const onAbort = () => reject(new Error('aborted'));
		signal.addEventListener('abort', onAbort, { once: true });
		promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
	});
}

async function resolvePublic(host, lookup, isAllowedIp, signal) {
	const family = net.isIP(host);
	let addrs;
	if (family) {
		addrs = [{ address: host, family }];
	} else if (signal.aborted) {
		// Better than relying on raceSignal's own guard: don't even start the
		// lookup once the deadline has already passed.
		throw new Error('aborted');
	} else {
		try {
			addrs = await raceSignal(lookup(host, { all: true }), signal);
		} catch (err) {
			// Only a real lookup failure (bad hostname, etc.) means "host not
			// found" — an abort must keep propagating so fetchPage reports it
			// as a timeout instead of masking it.
			if (signal.aborted) throw err;
			addrs = [];
		}
	}
	if (!addrs.length) throw new WebError('host not found');
	if (!addrs.every((a) => isAllowedIp(a.address))) throw new WebError('blocked');
	return addrs[0];
}

// ── Fetch ───────────────────────────────────────────────────────────────────

function requestOnce({ url, host }, addr, signal) {
	return new Promise((resolve, reject) => {
		const mod = url.protocol === 'https:' ? https : http;
		const req = mod.request(url, {
			method: 'GET',
			signal,
			agent: false,
			headers: {
				'User-Agent': USER_AGENT,
				Accept: 'text/html,text/plain;q=0.9,application/json;q=0.8,*/*;q=0.1',
				// No compressed bodies: readCapped/decodeBody treat the body as raw
				// text, so a compressed response would be misread as garbage instead
				// of being rejected outright.
				'Accept-Encoding': 'identity',
			},
			// Pin the connection to the address validated above
			lookup: (_host, options, cb) => (options && typeof options === 'object' && options.all
				? cb(null, [{ address: addr.address, family: addr.family }])
				: cb(null, addr.address, addr.family)),
			servername: net.isIP(host) ? undefined : host,
		}, resolve);
		req.on('error', reject);
		req.end();
	});
}

function readCapped(res) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		res.on('data', (chunk) => {
			size += chunk.length;
			if (size > MAX_BYTES) {
				chunks.push(chunk.subarray(0, chunk.length - (size - MAX_BYTES)));
				res.destroy();
				resolve(Buffer.concat(chunks));
				return;
			}
			chunks.push(chunk);
		});
		res.on('end', () => resolve(Buffer.concat(chunks)));
		res.on('error', reject);
	});
}

function decodeBody(buf, type) {
	const charset = /charset=([\w-]+)/i.exec(type)?.[1];
	try { return new TextDecoder(charset || 'utf-8').decode(buf); } catch { return new TextDecoder().decode(buf); }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function decodeEntities(s) {
	return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
		if (e[0] === '#') {
			const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
		}
		return ENTITIES[e.toLowerCase()] ?? m;
	});
}

// Linear-time removal of HTML comments. A lazy regex (`<!--[\s\S]*?-->`)
// rescans to end-of-string for every unterminated `<!--`, which is O(n^2) on
// adversarial input (e.g. many "<!--" with no closer) — scan with indexOf
// instead, which only ever walks forward.
function stripComments(html) {
	let out = '';
	let cursor = 0;
	for (;;) {
		const start = html.indexOf('<!--', cursor);
		if (start === -1) return out + html.slice(cursor);
		out += html.slice(cursor, start);
		const end = html.indexOf('-->', start + 4);
		if (end === -1) return out; // unterminated comment: drop the rest
		out += ' ';
		cursor = end + 3;
	}
}

// Case-insensitive `</tag[ \t...]*>` search in an already-lowercased string,
// starting at `from`. Returns the index just past the closing '>', or -1.
function findCloseTag(lower, tag, from) {
	const needle = '</' + tag;
	let p = from;
	for (;;) {
		p = lower.indexOf(needle, p);
		if (p === -1) return -1;
		let q = p + needle.length;
		while (q < lower.length && /\s/.test(lower[q])) q++;
		if (lower[q] === '>') return q + 1;
		p += needle.length;
	}
}

const BLOCKED_TAGS = /<(head|script|style|noscript|svg|nav|footer|form|iframe|template)\b/gi;

// Linear-time removal of head/script/style/etc. elements. The original
// `<(tag)\b[\s\S]*?<\/\1\s*>` lazy regex has the same O(n^2) rescan problem as
// the comment regex above (e.g. many unterminated "<nav" or "<script") —
// find each opener with the (non-backtracking) regex above, then look for
// its closer with indexOf, advancing a cursor that only ever moves forward.
function stripBlockedElements(html) {
	const lower = html.toLowerCase();
	let out = '';
	let cursor = 0;
	BLOCKED_TAGS.lastIndex = 0;
	let m;
	while ((m = BLOCKED_TAGS.exec(lower))) {
		out += html.slice(cursor, m.index);
		const closeEnd = findCloseTag(lower, m[1].toLowerCase(), m.index + m[0].length);
		if (closeEnd === -1) return out; // unterminated element: drop the rest
		out += ' ';
		cursor = closeEnd;
		BLOCKED_TAGS.lastIndex = cursor;
	}
	return out + html.slice(cursor);
}

// Linear-time <title> extraction. The lazy regex `<title[^>]*>([\s\S]*?)<\/title>`
// has the same O(n^2) rescan problem as the functions above: with no '>'
// anywhere in the input (e.g. many unterminated "<title"), `[^>]*` has to
// backtrack character-by-character to the end of the string before the whole
// match can fail, and it does that for every "<title" occurrence. Scan with
// indexOf instead — each step only ever moves forward.
function extractTitle(html) {
	const lower = html.toLowerCase();
	const start = lower.indexOf('<title');
	if (start === -1) return '';
	const openEnd = lower.indexOf('>', start + 6);
	if (openEnd === -1) return '';
	const closeStart = lower.indexOf('</title>', openEnd + 1);
	if (closeStart === -1) return '';
	return html.slice(openEnd + 1, closeStart);
}

const BLOCK_LEVEL_RE = /^(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/header)\b/i;
const TAG_START_RE = /[a-zA-Z/!?]/;

// HTML tokenizers only enter "tag open" state when '<' is followed by an
// ASCII letter (element name), '/' (closing tag), '!' (comment/doctype) or
// '?' (processing instruction) — any other character (e.g. the '<' in
// "a < b") is just a literal '<' in text. Without this check, a stray '<' in
// prose gets treated as a tag start and swallows everything up to the next
// unrelated '>' in the document.
function isTagStart(ch) {
	return ch !== undefined && TAG_START_RE.test(ch);
}

// Linear-time tag stripping (drop markup, keep text; block-level closers
// become newlines). The original two-pass regex
// (`<(br|...)\b[^>]*>` then `<[^>]+>`) has the same quadratic failure mode as
// the other regexes here: with no '>' anywhere after a run of unclosed tags
// (e.g. many "<br" with no closing '>'), `[^>]*`/`[^>]+` each have to
// backtrack to the end of the string to fail, once per "<" in the input.
// Scan with indexOf instead: each tag costs O(distance to the next '>'), and
// the cursor only ever moves forward, so the total is O(n).
function stripTags(html) {
	const lower = html.toLowerCase();
	let out = '';
	let cursor = 0;
	for (;;) {
		let tagStart = html.indexOf('<', cursor);
		while (tagStart !== -1 && !isTagStart(html[tagStart + 1])) tagStart = html.indexOf('<', tagStart + 1);
		if (tagStart === -1) return out + html.slice(cursor);
		const tagEnd = html.indexOf('>', tagStart + 1);
		if (tagEnd === -1) return out + html.slice(cursor); // no '>' left anywhere: nothing further can be a tag
		out += html.slice(cursor, tagStart);
		out += BLOCK_LEVEL_RE.test(lower.slice(tagStart + 1, tagEnd)) ? '\n' : ' ';
		cursor = tagEnd + 1;
	}
}

export function htmlToText(html) {
	const title = decodeEntities(extractTitle(html).trim());
	let s = stripTags(stripBlockedElements(stripComments(html)));
	s = decodeEntities(s)
		.replace(/[ \t\f\v\r ]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{2,}/g, '\n')
		.trim();
	return { title, text: s };
}

// Main content only, like Firefox's reader view, for pages too long for
// MAX_TEXT: menus, cookie banners and sidebars would otherwise fill most of
// it. Pages that fit are kept whole (Readability sometimes drops part of the
// content, e.g. a GitHub README's intro), as are pages with no clear article
// (listings, shops).
export function pageToText(html) {
	const whole = htmlToText(html);
	if (whole.text.length <= MAX_TEXT) return whole;
	try {
		const { document } = parseHTML(html);
		const article = new Readability(document, { maxElemsToParse: MAX_ELEMS }).parse();
		const { text } = htmlToText(article?.content || '');
		if (text.length >= 500) return { title: whole.title || article.title || '', text };
	} catch {
		// Unparseable or over MAX_ELEMS: the plain text below still works
	}
	return whole;
}

export async function fetchPage(raw, { lookup = dns.lookup, isAllowedIp = isPublicIp, ports = PORTS, timeoutMs = TIMEOUT_MS } = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		let current = raw;
		for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
			const target = checkUrl(current, ports);
			const addr = await resolvePublic(target.host, lookup, isAllowedIp, controller.signal);
			const res = await requestOnce(target, addr, controller.signal);
			// Drop the body without downloading it — redirects and error
			// pages can stream indefinitely, and res.resume() would still
			// pull all of it down (and hold the socket open) even though
			// nothing here reads it. destroy() closes the connection instead.
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				res.destroy();
				current = new URL(res.headers.location, target.url).href;
				continue;
			}
			if (res.statusCode >= 400) { res.destroy(); throw new WebError(`http ${res.statusCode}`); }
			// We asked for identity above; a server that answers with another
			// encoding anyway would have its compressed bytes read as raw text
			// (readCapped/decodeBody never decompress), so reject it outright.
			const encoding = String(res.headers['content-encoding'] || 'identity').toLowerCase();
			if (encoding !== 'identity') { res.destroy(); throw new WebError('unsupported content'); }
			const type = String(res.headers['content-type'] || 'text/plain');
			if (!TEXT_TYPES.test(type)) { res.destroy(); throw new WebError('unsupported content'); }
			const body = decodeBody(await readCapped(res), type);
			const { title, text } = HTML_TYPES.test(type) ? pageToText(body) : { title: '', text: body.trim() };
			return { url: target.url.href, title, text: text.slice(0, MAX_TEXT), truncated: text.length > MAX_TEXT };
		}
		throw new WebError('too many redirects');
	} catch (err) {
		if (err instanceof WebError) return { error: err.message };
		if (controller.signal.aborted) return { error: 'timeout' };
		return { error: 'fetch failed' };
	} finally {
		clearTimeout(timer);
	}
}

// ── Search ──────────────────────────────────────────────────────────────────

export async function search(query) {
	const q = String(query ?? '').trim().slice(0, 200);
	if (!q) return { error: 'empty query' };
	try {
		const res = await fetch(`${SEARXNG_URL}/search?q=${encodeURIComponent(q)}&format=json`, { signal: AbortSignal.timeout(8000) });
		if (!res.ok) return { error: 'search unavailable' };
		const data = await res.json();
		return {
			results: (data.results || []).slice(0, 5).map((r) => ({
				title: r.title || '', url: r.url, snippet: String(r.content || '').slice(0, 300),
			})),
		};
	} catch {
		return { error: 'search unavailable' };
	}
}
