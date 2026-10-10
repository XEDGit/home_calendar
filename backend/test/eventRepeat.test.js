import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWhen, expandEvents, withInstant } from '../eventRepeat.js';

// TZ defaults to Europe/Rome (ASSISTANT_TZ unset in tests). DST ends on
// Sun 25 Oct 2026 (CEST +2 → CET +1) and starts on Sun 29 Mar 2026.
const range = (a, b) => [new Date(a), new Date(b)];
const whens = (list) => list.map(e => e.when);

test('parseWhen: a time without a zone is Rome wall-clock time', () => {
	assert.equal(parseWhen('2026-10-15T09:10:00').toISOString(), '2026-10-15T07:10:00.000Z');
	assert.equal(parseWhen('2026-10-15T09:10').toISOString(), '2026-10-15T07:10:00.000Z');
	assert.equal(parseWhen('2026-12-15T09:10:00').toISOString(), '2026-12-15T08:10:00.000Z');
});

test('parseWhen: a time with a zone is taken as is', () => {
	assert.equal(parseWhen('2026-10-15T07:10:00.000Z').toISOString(), '2026-10-15T07:10:00.000Z');
	assert.equal(parseWhen('2026-10-15T09:10:00+02:00').toISOString(), '2026-10-15T07:10:00.000Z');
	assert.equal(parseWhen(new Date('2026-10-15T07:10:00Z')).toISOString(), '2026-10-15T07:10:00.000Z');
});

test('parseWhen: nonsense is null', () => {
	assert.equal(parseWhen('soon'), null);
	assert.equal(parseWhen(''), null);
	assert.equal(parseWhen(undefined), null);
});

test('a weekly event keeps its Rome time on every repeat, across the end of DST', () => {
	const ev = { _id: 'e1', title: 'Piano', when: '2026-10-01T09:10:00', repeatDays: 7 };
	const out = expandEvents([ev], ...range('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z'));
	assert.deepEqual(whens(out), [
		'2026-10-01T07:10:00.000Z', '2026-10-08T07:10:00.000Z', '2026-10-15T07:10:00.000Z',
		'2026-10-22T07:10:00.000Z', '2026-10-29T08:10:00.000Z',
	]);
	assert.ok(out.every(o => o.isOccurrence && o.originalEventId === 'e1' && o.originalEventDate === ev.when && o.title === 'Piano'));
});

test('a series stored with a Z time repeats the same way', () => {
	const ev = { _id: 'e1', when: '2026-10-01T07:10:00.000Z', repeatDays: 7 };
	const out = expandEvents([ev], ...range('2026-10-20T00:00:00Z', '2026-11-01T00:00:00Z'));
	assert.deepEqual(whens(out), ['2026-10-22T07:10:00.000Z', '2026-10-29T08:10:00.000Z']);
});

test('a series that started long before the range lands on its own weekday and time', () => {
	// Thu 1 Jan 2026, 09:00 in winter; July is summer time
	const ev = { _id: 'e1', when: '2026-01-01T09:00:00', repeatDays: 7 };
	const out = expandEvents([ev], ...range('2026-07-01T00:00:00Z', '2026-07-12T00:00:00Z'));
	assert.deepEqual(whens(out), ['2026-07-02T07:00:00.000Z', '2026-07-09T07:00:00.000Z']);
});

test('daily repeats step whole days through the start of DST', () => {
	const ev = { _id: 'e1', when: '2026-03-28T08:00:00', repeatDays: 1 };
	const out = expandEvents([ev], ...range('2026-03-28T00:00:00Z', '2026-03-31T00:00:00Z'));
	assert.deepEqual(whens(out), ['2026-03-28T07:00:00.000Z', '2026-03-29T06:00:00.000Z', '2026-03-30T06:00:00.000Z']);
});

test('one-off events inside the range come back with when as an instant; outside are dropped', () => {
	const inside = { _id: 'a', title: 'Late', when: '2026-10-15T23:30:00' };  // 21:30Z, inside
	const lateNight = { _id: 'b', when: '2026-10-31T23:30:00' };    // 22:30Z on the 31st: inside
	const outside = { _id: 'c', when: '2026-11-01T01:30:00' };      // 00:30Z on 1 Nov: outside
	const zeroRepeat = { _id: 'd', when: '2026-10-02T10:00:00', repeatDays: 0 };
	const out = expandEvents([inside, lateNight, outside, zeroRepeat], ...range('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z'));
	assert.deepEqual(out, [
		{ _id: 'a', title: 'Late', when: '2026-10-15T21:30:00.000Z' },
		{ _id: 'b', when: '2026-10-31T22:30:00.000Z' },
		{ _id: 'd', when: '2026-10-02T08:00:00.000Z', repeatDays: 0 },
	]);
	assert.equal(inside.when, '2026-10-15T23:30:00', 'the stored event is not changed');
});

test('a date-only event is midnight in Rome', () => {
	const out = expandEvents([{ _id: 'a', when: '2026-10-15' }], ...range('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z'));
	assert.deepEqual(whens(out), ['2026-10-14T22:00:00.000Z']);
});

test('withInstant gives any stored event an ISO when (for the list without a range)', () => {
	assert.deepEqual(withInstant({ _id: 'a', when: '2026-10-15T09:10:00', repeatDays: 7 }), { _id: 'a', when: '2026-10-15T07:10:00.000Z', repeatDays: 7 });
	assert.deepEqual(withInstant({ _id: 'b', when: 'soon' }), { _id: 'b', when: 'soon' });
});

test('a series starting after the range has no repeats in it', () => {
	const ev = { _id: 'e1', when: '2026-12-01T09:00:00', repeatDays: 7 };
	assert.deepEqual(expandEvents([ev], ...range('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z')), []);
});

test('events with an unreadable time are skipped instead of failing the request', () => {
	const ok = { _id: 'a', when: '2026-10-15T10:00:00' };
	assert.deepEqual(expandEvents([{ _id: 'x', when: 'soon' }, { _id: 'y' }, { _id: 'z', when: 'soon', repeatDays: 7 }, ok],
		...range('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z')).map(e => e._id), ['a']);
});

test('a huge range is capped per series', () => {
	const ev = { _id: 'e1', when: '2000-01-01T09:00:00', repeatDays: 1 };
	const out = expandEvents([ev], ...range('2000-01-01T00:00:00Z', '2100-01-01T00:00:00Z'));
	assert.equal(out.length, 1000);
});

test('an unreadable range returns nothing instead of looping forever', () => {
	const ev = { _id: 'e1', when: '2026-10-01T09:00:00', repeatDays: 7 };
	assert.deepEqual(expandEvents([ev], new Date('nonsense'), new Date('2026-11-01T00:00:00Z')), []);
	assert.deepEqual(expandEvents([ev], new Date('2026-10-01T00:00:00Z'), new Date('nonsense')), []);
	assert.deepEqual(expandEvents([ev], new Date('nonsense'), new Date('nonsense')), []);
});

test('a series that runs past the end of time stops', () => {
	const ev = { _id: 'e1', when: '2026-10-01T09:00:00', repeatDays: 1e9 };
	assert.deepEqual(whens(expandEvents([ev], new Date('2026-10-01T00:00:00Z'), new Date(8.64e15))), ['2026-10-01T07:00:00.000Z']);
});
