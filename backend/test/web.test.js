import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { isPublicIp, checkUrl, fetchPage, htmlToText, pageToText, raceSignal } from '../web.js';

test('isPublicIp rejects private, reserved and special IPv4', () => {
	for (const ip of ['0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1',
		'172.31.255.255', '192.0.0.1', '192.0.2.1', '192.168.1.1', '198.18.0.1', '198.51.100.1',
		'203.0.113.1', '224.0.0.1', '240.0.0.1', '255.255.255.255']) {
		assert.equal(isPublicIp(ip), false, ip);
	}
});

test('isPublicIp accepts public IPv4', () => {
	for (const ip of ['1.1.1.1', '8.8.8.8', '93.184.216.34', '172.32.0.1']) assert.equal(isPublicIp(ip), true, ip);
});

test('isPublicIp rejects private and special IPv6, including IPv4-mapped', () => {
	for (const ip of ['::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '64:ff9b::7f00:1',
		'2001:db8::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '::127.0.0.1', 'not-an-ip']) {
		assert.equal(isPublicIp(ip), false, ip);
	}
});

test('isPublicIp accepts public IPv6 and public IPv4-mapped', () => {
	for (const ip of ['2606:4700:4700::1111', '2a00:1450:4001::200e', '::ffff:8.8.8.8']) assert.equal(isPublicIp(ip), true, ip);
});

test('checkUrl rejects bad schemes, ports, credentials and internal hostnames', () => {
	for (const url of ['ftp://example.com/', 'file:///etc/passwd', 'http://example.com:8080/', 'https://example.com:3000/',
		'http://user:pw@example.com/', 'https://backend:3000/', 'http://database/', 'http://llm:8080/',
		'http://printer.local/', 'http://nas.lan/', 'http://x.internal/', 'http://localhost/', 'http://foo.localhost/', 'not a url']) {
		assert.throws(() => checkUrl(url), undefined, url);
	}
});

test('checkUrl accepts normal public URLs', () => {
	assert.equal(checkUrl('https://example.com/a?b=1').host, 'example.com');
	assert.equal(checkUrl('http://example.com:80/').port, 80);
});

test('fetchPage blocks literal private IPs in any encoding', async () => {
	for (const url of ['http://127.0.0.1/', 'http://2130706433/', 'http://0x7f.1/', 'http://[::1]/',
		'http://[::ffff:127.0.0.1]/', 'http://169.254.169.254/latest/meta-data/']) {
		assert.deepEqual(await fetchPage(url), { error: 'blocked' }, url);
	}
});

test('fetchPage blocks a public-looking host that resolves to a private IP', async () => {
	const lookup = async () => [{ address: '10.0.0.5', family: 4 }];
	assert.deepEqual(await fetchPage('http://evil.example/', { lookup }), { error: 'blocked' });
});

test('fetchPage blocks when any resolved address is private', async () => {
	const lookup = async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }];
	assert.deepEqual(await fetchPage('http://mixed.example/', { lookup }), { error: 'blocked' });
});

// Local stub server stands in for "the internet": the test allows its
// loopback address and port, then checks each hop is re-validated.
async function withServer(handler, fn) {
	const server = http.createServer(handler);
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const { port } = server.address();
	try { return await fn(port); } finally { server.close(); }
}
const stubOpts = (port, map) => ({
	ports: [port],
	isAllowedIp: (ip) => ip === '127.0.0.1' || isPublicIp(ip),
	lookup: async (host) => [{ address: map[host] ?? '203.0.113.9', family: 4 }],
});

test('fetchPage follows a redirect but blocks one to a private host', async () => {
	await withServer((req, res) => {
		if (req.url === '/to-private') { res.writeHead(302, { Location: `http://internal.example:${req.socket.localPort}/` }); return res.end(); }
		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.end('<title>Hi</title><p>ok</p>');
	}, async (port) => {
		const opts = stubOpts(port, { 'public.example': '127.0.0.1', 'internal.example': '10.0.0.1' });
		assert.deepEqual(await fetchPage(`http://public.example:${port}/to-private`, opts), { error: 'blocked' });
		const ok = await fetchPage(`http://public.example:${port}/`, opts);
		assert.equal(ok.title, 'Hi');
		assert.equal(ok.text.includes('ok'), true);
	});
});

test('fetchPage connects to the validated IP, not a second DNS answer', async () => {
	let calls = 0;
	await withServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('pinned'); }, async (port) => {
		const opts = stubOpts(port, {});
		opts.lookup = async () => (calls++ === 0 ? [{ address: '127.0.0.1', family: 4 }] : [{ address: '10.9.9.9', family: 4 }]);
		const out = await fetchPage(`http://rebind.example:${port}/`, opts);
		assert.equal(out.text, 'pinned');
		assert.equal(calls, 1);
	});
});

test('fetchPage refuses binary content and stops after 3 redirects', async () => {
	await withServer((req, res) => {
		if (req.url === '/img') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end('x'); }
		res.writeHead(302, { Location: '/loop' }); res.end();
	}, async (port) => {
		const opts = stubOpts(port, { 'public.example': '127.0.0.1' });
		assert.deepEqual(await fetchPage(`http://public.example:${port}/img`, opts), { error: 'unsupported content' });
		assert.deepEqual(await fetchPage(`http://public.example:${port}/loop`, opts), { error: 'too many redirects' });
	});
});

test('fetchPage never sends cookies or auth headers', async () => {
	let seen;
	await withServer((req, res) => { seen = req.headers; res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('x'); }, async (port) => {
		await fetchPage(`http://public.example:${port}/`, stubOpts(port, { 'public.example': '127.0.0.1' }));
	});
	assert.equal(seen.cookie, undefined);
	assert.equal(seen.authorization, undefined);
});

test('fetchPage sends Accept-Encoding: identity and rejects a non-identity encoded response', async () => {
	let seen;
	await withServer((req, res) => {
		seen = req.headers;
		res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Encoding': 'gzip' });
		res.end('irrelevant: rejected on the header alone, before this body is ever read as text');
	}, async (port) => {
		const opts = stubOpts(port, { 'public.example': '127.0.0.1' });
		assert.deepEqual(await fetchPage(`http://public.example:${port}/`, opts), { error: 'unsupported content' });
	});
	assert.equal(seen['accept-encoding'], 'identity');
});

test('htmlToText strips scripts, styles and tags, decodes entities', () => {
	const { title, text } = htmlToText(`<html><head><title>T &amp; U</title><style>p{}</style>
		<script>alert(1)</script></head><body><nav>menu</nav><h1>Head</h1><p>A&nbsp;b &lt;c&gt; &#39;d&#39;</p>
		<!-- hidden --><footer>foot</footer></body></html>`);
	assert.equal(title, 'T & U');
	assert.equal(text, 'Head\nA b <c> \'d\'');
});

test('htmlToText handles pathological unterminated tags/comments in linear time', () => {
	for (const html of ['<nav'.repeat(250000), '<!--'.repeat(250000), '<script'.repeat(150000),
		'<title'.repeat(170000), '<br'.repeat(250000)]) {
		const start = Date.now();
		htmlToText(html);
		const elapsed = Date.now() - start;
		assert.ok(elapsed < 1000, `expected < 1000ms, took ${elapsed}ms for input of length ${html.length}`);
	}
});

test('htmlToText keeps a stray "<" in prose as text instead of swallowing to the next ">"', () => {
	assert.equal(htmlToText('<p>a < b no closing angle bracket here</p>').text, 'a < b no closing angle bracket here');
	assert.equal(htmlToText('<p>only text with < in it near the end</p>').text, 'only text with < in it near the end');
});

test('htmlToText still strips real tags when text contains "<" followed by a letter', () => {
	// "<y" is followed by an ASCII letter, so per HTML tokenizer rules it DOES
	// start a tag-open attempt (same as a real browser would) — it has no
	// closing '>' of its own, so it runs on and consumes the next literal '>'
	// it finds, which happens to belong to the real "</p>" that follows. That
	// swallows the paragraph break between "x" and "z"; the second <p>/</p>
	// pair is unaffected and still closes normally. This is an inherent
	// ambiguity of malformed markup ("<y" with no closing '>' before another
	// tag), not a regression — a '<' followed by anything else (space,
	// punctuation, digit) is never mistaken for a tag, per the tests above.
	assert.equal(htmlToText('<p>x<y</p><p>z</p>').text, 'x z');
});

test('fetchPage destroys (does not drain) redirect and error response bodies', async () => {
	const closed = {};
	await withServer((req, res) => {
		closed[req.url] = new Promise((resolve) => res.once('close', resolve));
		const iv = setInterval(() => {
			try { res.write(Buffer.alloc(65536)); } catch { clearInterval(iv); }
		}, 1);
		res.once('close', () => clearInterval(iv));
		if (req.url === '/redirect') res.writeHead(302, { Location: `http://internal.example:${req.socket.localPort}/` });
		else res.writeHead(404, { 'Content-Type': 'text/plain' });
	}, async (port) => {
		const opts = stubOpts(port, { 'public.example': '127.0.0.1', 'internal.example': '10.0.0.1' });
		assert.deepEqual(await fetchPage(`http://public.example:${port}/redirect`, opts), { error: 'blocked' });
		assert.deepEqual(await fetchPage(`http://public.example:${port}/error`, opts), { error: 'http 404' });
		const timeout = (ms) => new Promise((resolve) => setTimeout(() => resolve('timeout'), ms));
		assert.notEqual(await Promise.race([closed['/redirect'], timeout(500)]), 'timeout');
		assert.notEqual(await Promise.race([closed['/error'], timeout(500)]), 'timeout');
	});
});

test('fetchPage times out when DNS lookup never resolves', async () => {
	const lookup = () => new Promise(() => {});
	assert.deepEqual(await fetchPage('http://stuck.example/', { lookup, timeoutMs: 50 }), { error: 'timeout' });
});

test('raceSignal does not leave an unhandled rejection when already aborted', async () => {
	let unhandled = false;
	const onUnhandledRejection = () => { unhandled = true; };
	process.on('unhandledRejection', onUnhandledRejection);
	try {
		const controller = new AbortController();
		controller.abort();
		// Simulates a lookup that was already in flight (started before the
		// caller knew the signal was aborted) and rejects shortly after.
		const alreadyStarted = new Promise((_resolve, reject) => setTimeout(() => reject(new Error('late dns failure')), 20));
		await assert.rejects(raceSignal(alreadyStarted, controller.signal));
		await new Promise((resolve) => setTimeout(resolve, 50));
		assert.equal(unhandled, false);
	} finally {
		process.off('unhandledRejection', onUnhandledRejection);
	}
});

test('pageToText keeps a page that fits whole, menus included', () => {
	const html = '<html><body><div class="menu">Home Shop</div><article><p>Short article.</p></article></body></html>';
	assert.equal(pageToText(html).text, htmlToText(html).text);
});

test('pageToText keeps only the main article of a long page', () => {
	const junk = Array.from({ length: 400 }, (_, i) => `<div class="sidebar"><a href="/c${i}">Category ${i}</a></div>`).join('');
	const body = Array.from({ length: 30 }, (_, i) => `<p>Paragraph ${i} of the real story, with enough words in it to look like prose, sentences, and commas.</p>`).join('');
	const { title, text } = pageToText(`<html><head><title>Story</title></head><body>${junk}<article><h1>Story</h1>${body}</article>${junk}</body></html>`);
	assert.equal(title, 'Story');
	assert.match(text, /Paragraph 0 of the real story/);
	assert.match(text, /Paragraph 29 of the real story/);
	assert.doesNotMatch(text, /Category/);
});

test('pageToText falls back to the whole text when no article stands out', () => {
	const html = '<html><body>' + Array.from({ length: 2000 }, (_, i) => `<div>item ${i}</div>`).join('') + '</body></html>';
	assert.equal(pageToText(html).text, htmlToText(html).text);
});
