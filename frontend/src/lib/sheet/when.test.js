// Run in the household's zone, whatever the machine's is
process.env.TZ = 'Europe/Rome';

const { test } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const W = await import('./when.js');

test('localParts reads a stored time on the local clock, to the minute', () => {
	assert.deepEqual(W.localParts('2026-10-15T09:10:00'), { date: '2026-10-15', time: '09:10' });
	// The old picker took the date from UTC: 00:30 in Rome is still the 16th
	assert.deepEqual(W.localParts('2026-10-15T22:30:00.000Z'), { date: '2026-10-16', time: '00:30' });
	assert.deepEqual(W.localParts('garbage'), { date: '', time: '' });
});

test('joinLocal stores a wall-clock time without a zone (the backend reads it as Rome time)', () => {
	assert.equal(W.joinLocal('2026-10-15', '09:10'), '2026-10-15T09:10:00');
	assert.equal(W.joinLocal('2026-10-15', ''), '2026-10-15T00:00:00');
	assert.equal(W.joinLocal('', '09:10'), '');
});

test('nextQuarterHour rounds up, and keeps an exact quarter', () => {
	assert.equal(W.nextQuarterHour(new Date('2026-10-15T09:10:00')).getMinutes(), 15);
	assert.equal(W.nextQuarterHour(new Date('2026-10-15T09:15:00')).getMinutes(), 15);
	const late = W.nextQuarterHour(new Date('2026-10-15T23:50:00'));
	assert.equal(W.dateInput(late), '2026-10-16');
	assert.equal(late.getHours(), 0);
});

test('addStart: a picked hour, otherwise the next quarter hour on that day', () => {
	const now = new Date('2026-10-10T16:05:00');
	assert.equal(W.joinLocal(...Object.values(W.localParts(W.addStart(new Date('2026-10-20T12:00:00'), 18, now)))), '2026-10-20T18:00:00');
	assert.equal(W.joinLocal(...Object.values(W.localParts(W.addStart(new Date('2026-10-20T12:00:00'), null, now)))), '2026-10-20T16:15:00');
	assert.equal(W.joinLocal(...Object.values(W.localParts(W.addStart(null, null, now)))), '2026-10-10T16:15:00');
});

test('repeat choices map to and from repeatDays', () => {
	assert.deepEqual(W.REPEATS.map(r => r.key), ['never', 'daily', 'weekly', 'monthly', 'yearly']);
	assert.equal(W.repeatKey(undefined), 'never');
	assert.equal(W.repeatKey(0), 'never');
	assert.equal(W.repeatKey(7), 'weekly');
	assert.equal(W.repeatKey(365), 'yearly');
	assert.equal(W.repeatKey(14), 'custom');
	assert.equal(W.repeatText(1), 'Every day');
	assert.equal(W.repeatText(30), 'Every month');
	assert.equal(W.repeatText(14), 'Every 14 days');
	assert.equal(W.repeatText(0), '');
});

test('formatWhen and formatDay read like an almanac entry', () => {
	const now = new Date('2026-10-10T12:00:00');
	assert.equal(W.formatWhen('2026-10-15T09:10:00', now), 'Thu 15 Oct · 09:10');
	assert.equal(W.formatWhen('2027-01-04T18:00:00', now), 'Mon 4 Jan 2027 · 18:00');
	assert.equal(W.formatDay('2026-10-15T09:10:00', now), 'Thu 15 Oct');
	assert.equal(W.formatWhen('nope', now), '');
});

test('deadlineInfo gives the day and how far it is', () => {
	const now = new Date('2026-10-10T16:00:00');
	assert.deepEqual(W.deadlineInfo('2026-10-20T00:00:00.000Z', now), { day: 'Tue 20 Oct', hint: 'in 10 days', overdue: false });
	assert.deepEqual(W.deadlineInfo('2026-10-11', now), { day: 'Sun 11 Oct', hint: 'tomorrow', overdue: false });
	assert.deepEqual(W.deadlineInfo('2026-10-10', now), { day: 'Sat 10 Oct', hint: 'today', overdue: false });
	assert.deepEqual(W.deadlineInfo('2026-10-09', now), { day: 'Fri 9 Oct', hint: 'yesterday', overdue: true });
	assert.deepEqual(W.deadlineInfo('2026-10-07', now), { day: 'Wed 7 Oct', hint: '3 days ago', overdue: true });
	assert.equal(W.deadlineInfo('', now), null);
});

test('dateInput turns a stored deadline into the date field value', () => {
	assert.equal(W.dateInput('2026-10-20T00:00:00.000Z'), '2026-10-20');
	assert.equal(W.dateInput('2026-10-20'), '2026-10-20');
	assert.equal(W.dateInput(new Date('2026-10-20T15:00:00')), '2026-10-20');
	assert.equal(W.dateInput(''), '');
	assert.equal(W.dateInput(null), '');
});

test('quick deadlines', () => {
	const now = new Date('2026-10-10T16:00:00');
	assert.deepEqual(W.QUICK_DEADLINES.map(q => [q.label, q.date(now)]), [
		['Today', '2026-10-10'], ['Tomorrow', '2026-10-11'], ['Next week', '2026-10-17'],
	]);
});
