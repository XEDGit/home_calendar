// Splits model text into plain parts and links, so results can show
// clickable URLs without rendering any HTML from the model.
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

export function linkify(text) {
	const parts = [];
	let last = 0;
	for (const m of String(text ?? '').matchAll(URL_RE)) {
		const url = m[0].replace(/[.,;:!?]+$/, '');
		if (m.index > last) parts.push({ text: text.slice(last, m.index) });
		parts.push({ text: url, url });
		last = m.index + url.length;
	}
	if (last < String(text ?? '').length) parts.push({ text: text.slice(last) });
	return parts;
}
