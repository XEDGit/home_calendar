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

test('# headings carry their depth', () => {
	assert.deepEqual(parse('# Today\n## Chores\n#### Deep'), [
		{ type: 'heading', depth: 1, inline: [text('Today')] },
		{ type: 'heading', depth: 2, inline: [text('Chores')] },
		{ type: 'heading', depth: 4, inline: [text('Deep')] },
	]);
});

test('# needs a space after it; closing hashes are dropped', () => {
	assert.deepEqual(parse('#hashtag'), [{ type: 'para', lines: [[text('#hashtag')]] }]);
	assert.deepEqual(parse('## Week ##'), [{ type: 'heading', depth: 2, inline: [text('Week')] }]);
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
	assert.deepEqual(parse('--'), [{ type: 'para', lines: [[text('--')]] }]);
});

test('--- (three or more hyphens, spaces allowed) is a rule', () => {
	for (const line of ['---', '-----', '- - -', '  ---  ']) assert.deepEqual(parse(line), [{ type: 'rule' }], line);
});

test('a rule ends the paragraph or list before it, and never makes a heading', () => {
	assert.deepEqual(parse('Monday\n---\n- bins\n---\nTuesday'), [
		{ type: 'para', lines: [[text('Monday')]] },
		{ type: 'rule' },
		{ type: 'list', items: [{ depth: 0, inline: [text('bins')] }] },
		{ type: 'rule' },
		{ type: 'para', lines: [[text('Tuesday')]] },
	]);
});

test('hyphens with text, and other rule styles, stay literal', () => {
	assert.deepEqual(parse('--- note'), [{ type: 'para', lines: [[text('--- note')]] }]);
	assert.deepEqual(parse('***'), [{ type: 'para', lines: [[text('***')]] }]);
	assert.deepEqual(parse('___'), [{ type: 'para', lines: [[text('___')]] }]);
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
		{ type: 'heading', depth: 1, inline: [{ t: 'strong', children: [text('Big')] }, text(' day')] },
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

test('emphasis around a URL leaves the URL whole (links are found in text nodes)', () => {
	assert.deepEqual(parse('- **https://example.com/a_b?x=1** and *http://x.io*'), [
		{ type: 'list', items: [{ depth: 0, inline: [
			{ t: 'strong', children: [text('https://example.com/a_b?x=1')] }, text(' and '), { t: 'em', children: [text('http://x.io')] },
		] }] },
	]);
});

const cell = (v) => (v ? [text(v)] : []);
const table = (head, rows, align = head.map(() => null)) => ({ type: 'table', align, head: head.map(cell), rows: rows.map(r => r.map(cell)) });

test('a header row, a delimiter row and body rows make a table', () => {
	assert.deepEqual(parse('| Chore | Who |\n|-------|-----|\n| Bins | Luca |\n| Recycling | Anna |'),
		[table(['Chore', 'Who'], [['Bins', 'Luca'], ['Recycling', 'Anna']])]);
});

test('outer pipes are optional', () => {
	assert.deepEqual(parse('Chore | Who\n--- | ---\nBins | Luca'), [table(['Chore', 'Who'], [['Bins', 'Luca']])]);
});

test('colons in the delimiter row set column alignment', () => {
	assert.deepEqual(parse('| a | b | c | d |\n|:--|:-:|--:|---|\n| 1 | 2 | 3 | 4 |'),
		[table(['a', 'b', 'c', 'd'], [['1', '2', '3', '4']], ['left', 'center', 'right', null])]);
});

test('a table with only a header row has no body', () => {
	assert.deepEqual(parse('| a | b |\n| - | - |'), [table(['a', 'b'], [])]);
});

test('rows are padded or cut to the header width', () => {
	assert.deepEqual(parse('| a | b |\n|---|---|\n| 1 |\n| 1 | 2 | 3 |'), [table(['a', 'b'], [['1', ''], ['1', '2']])]);
});

test('\\| is a literal pipe inside a cell', () => {
	assert.deepEqual(parse('| a | b |\n|---|---|\n| x \\| y | z |'), [table(['a', 'b'], [['x | y', 'z']])]);
});

test('cells take inline formatting', () => {
	assert.deepEqual(parse('| Who | Note |\n|---|---|\n| **Luca** | *today* |'), [{
		type: 'table', align: [null, null], head: [cell('Who'), cell('Note')],
		rows: [[[{ t: 'strong', children: [text('Luca')] }], [{ t: 'em', children: [text('today')] }]]],
	}]);
});

test('the table ends at a blank line or a line without a pipe; text around it stays paragraphs', () => {
	assert.deepEqual(parse('Here you go:\n| a | b |\n|---|---|\n| 1 | 2 |\nThat is all.\n\n| c |\n|---|\n| 3 |'), [
		{ type: 'para', lines: [[text('Here you go:')]] },
		table(['a', 'b'], [['1', '2']]),
		{ type: 'para', lines: [[text('That is all.')]] },
		table(['c'], [['3']]),
	]);
});

test('without a matching delimiter row, pipes are just text', () => {
	assert.deepEqual(parse('Luca | Anna'), [{ type: 'para', lines: [[text('Luca | Anna')]] }]);
	// header still streaming in: no delimiter yet
	assert.deepEqual(parse('| a | b |'), [{ type: 'para', lines: [[text('| a | b |')]] }]);
	// delimiter with a different number of columns
	assert.deepEqual(parse('| a | b |\n|---|\n| 1 | 2 |'), [{ type: 'para', lines: [[text('| a | b |')], [text('|---|')], [text('| 1 | 2 |')]] }]);
	// a --- rule under a pipe line is a rule, not a delimiter
	assert.deepEqual(parse('a | b\n---'), [{ type: 'para', lines: [[text('a | b')]] }, { type: 'rule' }]);
});

test('HTML in a cell stays text', () => {
	assert.deepEqual(parse('| a |\n|---|\n| <img src=x onerror=alert(1)> |'), [table(['a'], [['<img src=x onerror=alert(1)>']])]);
});
