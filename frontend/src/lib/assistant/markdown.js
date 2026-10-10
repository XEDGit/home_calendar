// The little markdown the assistant's replies may use: `#` headings, `-` and
// `*` list items, `---` rules, **bold** and *italic*. Everything else stays
// literal text.
//
// parse() returns a tree of plain objects, never HTML: the component renders
// it as elements with text children, so anything in a reply (the model's own
// words or a web page it read) can only ever show up as text.
//
//   block:  { type: 'heading', depth, inline }          depth = number of #
//           { type: 'list', items: [{ depth, inline }] } depth 0-2 (nesting)
//           { type: 'rule' }                            a --- line
//           { type: 'para', lines: [inline, ...] }      one entry per line
//   inline: { t: 'text', v } | { t: 'strong', children } | { t: 'em', children }

const HEADING = /^(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const ITEM = /^([ \t]*)[-*][ \t]+(.*)$/;
// Three or more hyphens, spaces between allowed ("- - -" is a rule, not an
// item). Unlike markdown, a --- under a line never turns it into a heading.
const RULE = /^[ \t]*-(?:[ \t]*-){2,}[ \t]*$/;

export function parse(source) {
	const blocks = [];
	let para = null;
	let list = null;
	const end = () => { para = null; list = null; };

	for (const line of String(source ?? '').split(/\r?\n/)) {
		let m;
		if (!line.trim()) {
			end();
		} else if (RULE.test(line)) {
			end();
			blocks.push({ type: 'rule' });
		} else if ((m = HEADING.exec(line))) {
			end();
			blocks.push({ type: 'heading', depth: m[1].length, inline: parseInline(m[2]) });
		} else if ((m = ITEM.exec(line))) {
			para = null;
			if (!list) blocks.push((list = { type: 'list', items: [] }));
			const indent = m[1].replace(/\t/g, '  ').length;
			list.items.push({ depth: Math.min(2, Math.floor(indent / 2)), inline: parseInline(m[2]) });
		} else {
			list = null;
			if (!para) blocks.push((para = { type: 'para', lines: [] }));
			para.lines.push(parseInline(line.trim()));
		}
	}
	return blocks;
}

export function parseInline(s) {
	const out = [];
	let buf = '';
	let i = 0;
	while (i < s.length) {
		if (s[i] === '\\' && s[i + 1] === '*') {
			buf += '*';
			i += 2;
			continue;
		}
		if (s[i] === '*') {
			const mark = s[i + 1] === '*' ? '**' : '*';
			const from = i + mark.length;
			const close = closing(s, from, mark);
			if (close !== -1) {
				if (buf) out.push({ t: 'text', v: buf });
				buf = '';
				out.push({ t: mark === '**' ? 'strong' : 'em', children: parseInline(s.slice(from, close)) });
				i = close + mark.length;
				continue;
			}
			// No partner (or one still streaming in): the marker is just text
			buf += mark;
			i = from;
			continue;
		}
		buf += s[i++];
	}
	if (buf) out.push({ t: 'text', v: buf });
	return out;
}

// Where `mark` closes a run that starts at `from`, or -1. Like markdown,
// a run can't start or end with a space ("2 * 3 * 4" is not italic), and
// an italic run skips over the ** pairs of a bold run inside it.
function closing(s, from, mark) {
	if (from >= s.length || /\s/.test(s[from])) return -1;
	for (let j = from + 1; j < s.length; j++) {
		if (s[j] === '\\') { j++; continue; }
		if (s[j] !== '*') continue;
		const double = s[j + 1] === '*';
		if (mark === '*' && double) { j++; continue; }
		if (mark === '**' && !double) continue;
		if (!/\s/.test(s[j - 1])) return j;
		if (double) j++;
	}
	return -1;
}
