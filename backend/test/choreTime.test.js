import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetChore } from '../choreTime.js';

const NOW = new Date('2026-10-13T10:00:00');

test('reset restarts a day-based chore at its full interval and clears room progress', () => {
	const chore = {
		name: 'Vacuum', repetition: 7, nextTime: -5, daysNextTime: -5, timeMeasure: 'days', notes: 'x',
		rooms: [{ _id: 'a', name: 'Kitchen', done: true }, { _id: 'b', name: 'Bath', done: false }],
	};
	assert.deepEqual(resetChore(chore, NOW), {
		nextTime: 7, daysNextTime: 7, timeMeasure: 'days',
		rooms: [{ _id: 'a', name: 'Kitchen', done: false }, { _id: 'b', name: 'Bath', done: false }],
	});
});

test('reset of a daily chore says "day"', () => {
	const out = resetChore({ repetition: 1, nextTime: -3, rooms: [] }, NOW);
	assert.equal(out.nextTime, 1);
	assert.equal(out.daysNextTime, 1);
	assert.equal(out.timeMeasure, 'day');
});

test('reset of a monthly chore counts the real days to the same date next month', () => {
	// 31 = 1 month: 13 Oct → 13 Nov is 31 days
	const out = resetChore({ repetition: 31, nextTime: 28, rooms: [] }, NOW);
	assert.equal(out.nextTime, 31);
	assert.equal(out.daysNextTime, 31);
	assert.equal(out.timeMeasure, 'month');
});

test('reset of a two-monthly chore counts the real days two months on', () => {
	// 32 = 2 months: 13 Oct → 13 Dec is 61 days
	const out = resetChore({ repetition: 32, nextTime: 30, rooms: [] }, NOW);
	assert.equal(out.nextTime, 32);
	assert.equal(out.daysNextTime, 61);
	assert.equal(out.timeMeasure, 'months');
});

test('a chore without a usable repetition is left alone', () => {
	assert.equal(resetChore({ nextTime: -4, rooms: [] }, NOW), null);
	assert.equal(resetChore({ repetition: 0, nextTime: -4, rooms: [] }, NOW), null);
});
