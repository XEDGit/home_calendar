import { localToDate, dateToLocal } from './assistantTools.js';

// When automations run. A schedule is "every N minutes/hours/days", and
// daily-style schedules may pin a local wall-clock time. Local times go
// through date strings so DST changes never shift "08:00".
// Invalid schedules yield null (not an exception or infinite loop).

export const MIN_INTERVAL_MINUTES = 15;
const UNIT_MS = { minutes: 60 * 1000, hours: 3600 * 1000, days: 24 * 3600 * 1000 };
const MAX_EVERY = { minutes: 60 * 24 * 365, hours: 24 * 365, days: 365 };
const AT = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateSchedule({ every, unit, at } = {}) {
	const n = Number(every);
	if (!UNIT_MS[unit]) return { error: 'unit must be minutes, hours or days' };
	if (!Number.isInteger(n) || n < 1 || n > MAX_EVERY[unit]) return { error: 'every must be a whole number' };
	if (n * UNIT_MS[unit] < MIN_INTERVAL_MINUTES * UNIT_MS.minutes) {
		return { error: `automations can run at most every ${MIN_INTERVAL_MINUTES} minutes` };
	}
	if (at !== undefined && at !== null && at !== '') {
		if (unit !== 'days') return { error: 'a time of day only works with days' };
		if (!AT.test(at)) return { error: 'time must be HH:MM' };
		return { schedule: { every: n, unit, at } };
	}
	return { schedule: { every: n, unit } };
}

function addLocalDays(day, n) {
	const [y, m, d] = day.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function atOn(day, at) {
	return localToDate(`${day}T${at}`);
}

export function firstRun(schedule, now) {
	const validation = validateSchedule(schedule);
	if (validation.error) return null;
	const s = validation.schedule;
	if (!s.at) return new Date(now.getTime() + s.every * UNIT_MS[s.unit]);
	const today = dateToLocal(now, false);
	const candidate = atOn(today, s.at);
	return candidate > now ? candidate : atOn(addLocalDays(today, 1), s.at);
}

export function nextRun(schedule, slot, now) {
	const validation = validateSchedule(schedule);
	if (validation.error) return null;
	const s = validation.schedule;

	// If slot is not a valid Date, use firstRun
	if (!(slot instanceof Date) || isNaN(slot)) {
		return firstRun(s, now);
	}

	// Reference time: result must be strictly after both slot and now
	const ref = now > slot ? now : slot;

	if (!s.at) {
		const step = s.every * UNIT_MS[s.unit];
		const missed = Math.floor((ref.getTime() - slot.getTime()) / step);
		return new Date(slot.getTime() + Math.max(1, missed + 1) * step);
	}

	// Days+at: O(1) calculation. Parse local day strings and count days.
	const slotDay = dateToLocal(slot, false).slice(0, 10);
	const refDay = dateToLocal(ref, false).slice(0, 10);

	// Parse days as [y, m, d]
	const parseDay = (dayStr) => {
		const [y, m, d] = dayStr.split('-').map(Number);
		return [y, m, d];
	};

	const [sy, sm, sd] = parseDay(slotDay);
	const [ry, rm, rd] = parseDay(refDay);

	// Calculate day number from epoch (UTC)
	const dayNum = (y, m, d) => {
		return new Date(Date.UTC(y, m - 1, d)).getTime() / (24 * 3600 * 1000);
	};

	const slotDayNum = dayNum(sy, sm, sd);
	const refDayNum = dayNum(ry, rm, rd);
	const dayDiff = refDayNum - slotDayNum;

	// Find smallest multiple of every that lands on/after ref's day
	const numSteps = Math.ceil(dayDiff / s.every);
	let candidate = atOn(addLocalDays(slotDay, numSteps * s.every), s.at);

	// If candidate is still <= ref, add s.every more days once
	if (candidate <= ref) {
		candidate = atOn(addLocalDays(slotDay, (numSteps + 1) * s.every), s.at);
	}

	return candidate;
}

export function scheduleText({ every, unit, at }) {
	if (at) return every === 1 ? `daily at ${at}` : `every ${every} days at ${at}`;
	if (unit === 'minutes') return `every ${every} min`;
	if (unit === 'hours') return every === 1 ? 'every hour' : `every ${every} h`;
	return every === 1 ? 'every day' : `every ${every} days`;
}
