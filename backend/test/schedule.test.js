import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ASSISTANT_TZ = 'Europe/Rome';
const { validateSchedule, firstRun, nextRun, scheduleText } = await import('../automationSchedule.js');
const { localToDate, dateToLocal } = await import('../assistantTools.js');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

test('validateSchedule enforces the 15 minute minimum and shapes', () => {
	assert.ok(validateSchedule({ every: 10, unit: 'minutes' }).error);
	assert.deepEqual(validateSchedule({ every: 15, unit: 'minutes' }), { schedule: { every: 15, unit: 'minutes' } });
	assert.deepEqual(validateSchedule({ every: '2', unit: 'hours' }), { schedule: { every: 2, unit: 'hours' } });
	assert.deepEqual(validateSchedule({ every: 1, unit: 'days', at: '08:00' }), { schedule: { every: 1, unit: 'days', at: '08:00' } });
	assert.deepEqual(validateSchedule({ every: 1, unit: 'days', at: '' }), { schedule: { every: 1, unit: 'days' } });
	for (const bad of [
		{ every: 0, unit: 'hours' }, { every: 1.5, unit: 'hours' }, { every: 'abc', unit: 'days' },
		{ every: 1, unit: 'weeks' }, { every: 2, unit: 'hours', at: '08:00' }, { every: 1, unit: 'days', at: '25:00' },
		{ every: 1, unit: 'days', at: '8:00' }, { every: 100000, unit: 'days' }, {},
	]) assert.ok(validateSchedule(bad).error, JSON.stringify(bad));
});

test('firstRun for intervals is one interval from now', () => {
	const now = new Date('2026-09-24T10:00:00Z');
	assert.equal(firstRun({ every: 15, unit: 'minutes' }, now).getTime(), now.getTime() + 15 * MIN);
	assert.equal(firstRun({ every: 2, unit: 'hours' }, now).getTime(), now.getTime() + 2 * HOUR);
	assert.equal(firstRun({ every: 1, unit: 'days' }, now).getTime(), now.getTime() + 24 * HOUR);
});

test('firstRun for days at HH:MM is the next local HH:MM', () => {
	const before = localToDate('2026-09-24T07:00');
	const after = localToDate('2026-09-24T09:00');
	const s = { every: 1, unit: 'days', at: '08:00' };
	assert.equal(dateToLocal(firstRun(s, before)), '2026-09-24T08:00');
	assert.equal(dateToLocal(firstRun(s, after)), '2026-09-25T08:00');
	assert.equal(dateToLocal(firstRun(s, localToDate('2026-09-24T08:00'))), '2026-09-25T08:00');
});

test('nextRun skips missed slots and keeps alignment', () => {
	const slot = new Date('2026-09-24T10:00:00Z');
	const now = new Date(slot.getTime() + 5 * HOUR + 10 * MIN);
	const next = nextRun({ every: 1, unit: 'hours' }, slot, now);
	assert.equal(next.getTime(), slot.getTime() + 6 * HOUR);
});

test('nextRun for days at HH:MM keeps local time across DST end', () => {
	// Europe/Rome leaves summer time on 2026-10-25
	const s = { every: 1, unit: 'days', at: '08:00' };
	const slot = localToDate('2026-10-24T08:00');
	const next = nextRun(s, slot, slot);
	assert.equal(dateToLocal(next), '2026-10-25T08:00');
	assert.equal(next.getTime() - slot.getTime(), 25 * HOUR);
});

test('nextRun for every 3 days at HH:MM steps whole days', () => {
	const s = { every: 3, unit: 'days', at: '20:30' };
	const slot = localToDate('2026-09-24T20:30');
	assert.equal(dateToLocal(nextRun(s, slot, slot)), '2026-09-27T20:30');
	assert.equal(dateToLocal(nextRun(s, slot, localToDate('2026-09-28T00:00'))), '2026-09-30T20:30');
});

test('scheduleText', () => {
	assert.equal(scheduleText({ every: 15, unit: 'minutes' }), 'every 15 min');
	assert.equal(scheduleText({ every: 1, unit: 'hours' }), 'every hour');
	assert.equal(scheduleText({ every: 2, unit: 'hours' }), 'every 2 h');
	assert.equal(scheduleText({ every: 1, unit: 'days' }), 'every day');
	assert.equal(scheduleText({ every: 3, unit: 'days' }), 'every 3 days');
	assert.equal(scheduleText({ every: 1, unit: 'days', at: '08:00' }), 'daily at 08:00');
	assert.equal(scheduleText({ every: 2, unit: 'days', at: '08:00' }), 'every 2 days at 08:00');
});

test('firstRun returns null for invalid schedule', () => {
	const now = new Date('2026-09-24T10:00:00Z');
	assert.equal(firstRun({}, now), null);
	assert.equal(firstRun({ every: 1, unit: 'days', at: 'abc' }, now), null);
	assert.equal(firstRun({ every: -1, unit: 'days', at: '08:00' }, now), null);
});

test('nextRun returns null for invalid schedule and does not hang', () => {
	const now = new Date('2026-09-24T10:00:00Z');
	assert.equal(nextRun({}, new Date(), now), null);
	assert.equal(nextRun({ every: 1, unit: 'days', at: 'abc' }, new Date(), now), null);
	assert.equal(nextRun({ every: 1, unit: 'days', at: 800 }, new Date(), now), null);
	assert.equal(nextRun({ every: -1, unit: 'days', at: '08:00' }, new Date(), now), null);
});

test('nextRun with invalid slot falls back to firstRun', () => {
	const now = localToDate('2026-09-24T10:00');
	const s = { every: 1, unit: 'days', at: '08:00' };
	const nextWithNull = nextRun(s, null, now);
	const nextWithInvalidDate = nextRun(s, new Date('invalid'), now);
	const first = firstRun(s, now);
	assert.deepEqual(nextWithNull, first);
	assert.deepEqual(nextWithInvalidDate, first);
});

test('nextRun is O(1): 10-year-stale slot for daily at time is fast and correct', () => {
	const now = localToDate('2026-09-24T10:00');
	const staleSlot = localToDate('2016-09-24T08:00');
	const s = { every: 1, unit: 'days', at: '08:00' };
	const start = Date.now();
	const next = nextRun(s, staleSlot, now);
	const elapsed = Date.now() - start;
	assert.ok(elapsed < 20, `nextRun took ${elapsed}ms, expected < 20ms`);
	assert.equal(dateToLocal(next), '2026-09-25T08:00');
	assert.ok(next > now, 'result must be strictly after now');
});

test('nextRun respects slot > now: every:1 slot 2026-09-26T08:00 now 2026-09-24T08:00 → 2026-09-27T08:00', () => {
	const now = localToDate('2026-09-24T08:00');
	const slot = localToDate('2026-09-26T08:00');
	const s = { every: 1, unit: 'days', at: '08:00' };
	const next = nextRun(s, slot, now);
	assert.equal(dateToLocal(next), '2026-09-27T08:00');
	assert.ok(next > slot, 'result must be strictly after slot');
	assert.ok(next > now, 'result must be strictly after now');
});

test('nextRun respects slot > now with multi-day interval: every:2 slot 2026-09-30T08:00 now 2026-09-24T08:00 → 2026-10-02T08:00', () => {
	const now = localToDate('2026-09-24T08:00');
	const slot = localToDate('2026-09-30T08:00');
	const s = { every: 2, unit: 'days', at: '08:00' };
	const next = nextRun(s, slot, now);
	assert.equal(dateToLocal(next), '2026-10-02T08:00');
	assert.ok(next > slot, 'result must be strictly after slot');
	assert.ok(next > now, 'result must be strictly after now');
});

test('nextRun with interval: slot future (now + 3h) → next is slot + 1 interval', () => {
	const now = new Date('2026-09-24T10:00:00Z');
	const slot = new Date(now.getTime() + 3 * HOUR);
	const s = { every: 1, unit: 'hours' };
	const next = nextRun(s, slot, now);
	assert.equal(next.getTime(), slot.getTime() + HOUR);
	assert.ok(next > slot, 'result must be strictly after slot');
	assert.ok(next > now, 'result must be strictly after now');
});
