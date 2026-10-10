import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseInline } from './markdown.js';

const text = (v) => ({ t: 'text', v });

test('plain text is one paragraph; single newlines stay line breaks', () => {
	assert.deepEqual(parse('Hello\nthere'), [{ type: 'para', lines: [[text('Hello')], [text('there')]] }]);
});

test('blank lines split paragraphs', () => {
	assert.deepEqual(parse('One\n\n\nTwo'), [
		{ type: 'para', lines: [[text('One')]] },
		{ type: 'para', lines: [[text('Two')]] },
	]);
});

test('# headings, levels offset below the page and panel headings', () => {
	assert.deepEqual(parse('# Today\n## Chores\n#### Deep'), [
		{ type: 'heading', depth: 1, level: 3, inline: [text('Today')] },
		{ type: 'heading', depth: 2, level: 4, inline: [text('Chores')] },
		{ type: 'heading', depth: 4, level: 6, inline: [text('Deep')] },
	]);
});

test('# needs a space after it; closing hashes are dropped', () => {
	assert.deepEqual(parse('#hashtag'), [{ type: 'para', lines: [[text('#hashtag')]] }]);
	assert.deepEqual(parse('## Week ##'), [{ type: 'heading', depth: 2, level: 4, inline: [text('Week')] }]);
});

test('- and * start list items; consecutive items share one list', () => {
	assert.deepEqual(parse('Due:\n- Bins\n* Laundry'), [
		{ type: 'para', lines: [[text('Due:')]] },
		{ type: 'list', items: [{ depth: 0, inline: [text('Bins')] }, { depth: 0, inline: [text('Laundry')] }] },
	]);
});

test('indented items nest, capped at two levels', () => {
	assert.deepEqual(parse('- a\n  - b\n    - c\n        - d').map(b => b.items.map(i => i.depth)), [[0, 1, 2, 2]]);
});

test('a marker without a following space is not a list', () => {
	assert.deepEqual(parse('-5 degrees'), [{ type: 'para', lines: [[text('-5 degrees')]] }]);
	assert.deepEqual(parse('---'), [{ type: 'para', lines: [[text('---')]] }]);
});

test('other markdown stays literal text', () => {
	assert.deepEqual(parse('1. one\n> quote\n[link](http://x) `code`'), [
		{ type: 'para', lines: [[text('1. one')], [text('> quote')], [text('[link](http://x) `code`')]] },
	]);
});

test('**bold** and *italic*', () => {
	assert.deepEqual(parseInline('a **b** c *d* e'), [
		text('a '), { t: 'strong', children: [text('b')] }, text(' c '), { t: 'em', children: [text('d')] }, text(' e'),
	]);
});

test('bold inside italic and italic inside bold', () => {
	assert.deepEqual(parseInline('*a **b** c*'), [
		{ t: 'em', children: [text('a '), { t: 'strong', children: [text('b')] }, text(' c')] },
	]);
	assert.deepEqual(parseInline('**a *b* c**'), [
		{ t: 'strong', children: [text('a '), { t: 'em', children: [text('b')] }, text(' c')] },
	]);
});

test('unclosed or space-padded markers stay literal (also mid-stream)', () => {
	assert.deepEqual(parseInline('**still typing'), [text('**still typing')]);
	assert.deepEqual(parseInline('2 * 3 * 4'), [text('2 * 3 * 4')]);
	assert.deepEqual(parseInline('** spaced **'), [text('** spaced **')]);
	assert.deepEqual(parseInline('*'), [text('*')]);
});

test('\\* is a literal asterisk', () => {
	assert.deepEqual(parseInline('\\*not italic\\*'), [text('*not italic*')]);
});

test('emphasis inside headings and list items', () => {
	assert.deepEqual(parse('# **Big** day\n- *Mia* dentist'), [
		{ type: 'heading', depth: 1, level: 3, inline: [{ t: 'strong', children: [text('Big')] }, text(' day')] },
		{ type: 'list', items: [{ depth: 0, inline: [{ t: 'em', children: [text('Mia')] }, text(' dentist')] }] },
	]);
});

test('HTML is never interpreted: it comes back as plain text', () => {
	const evil = '<img src=x onerror=alert(1)> **<b>hi</b>**';
	assert.deepEqual(parseInline(evil), [text('<img src=x onerror=alert(1)> '), { t: 'strong', children: [text('<b>hi</b>')] }]);
});

test('CRLF and empty input', () => {
	assert.deepEqual(parse('a\r\n- b'), [{ type: 'para', lines: [[text('a')]] }, { type: 'list', items: [{ depth: 0, inline: [text('b')] }] }]);
	assert.deepEqual(parse(''), []);
	assert.deepEqual(parse(null), []);
});
