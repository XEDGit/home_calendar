// Dates and times for the event and todo sheets, on the device's clock.
//
// Event times are stored as wall-clock time without a zone
// ("2026-10-15T09:10:00"); the backend reads those as the household's zone
// (backend/eventRepeat.js). Repeats come back from the server as ISO
// instants. Either way `new Date(when)` gives the right local time here.

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');

function toDate(v) {
	if (v == null || v === '') return null;
	// A bare date ("2026-10-20") is that day here, not midnight UTC
	const m = typeof v === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
	const d = m ? new Date(+m[1], m[2] - 1, +m[3]) : new Date(v);
	return isNaN(d) ? null : d;
}

/** Value for <input type="date">: "YYYY-MM-DD" on the local clock, or ''. */
export function dateInput(v) {
	const d = toDate(v);
	return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
}

/** A stored time split for the date and time fields, to the minute. */
export function localParts(when) {
	const d = toDate(when);
	if (!d) return { date: '', time: '' };
	return { date: dateInput(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/** The date and time fields joined back into a stored time. */
export function joinLocal(date, time) {
	if (!date) return '';
	return `${date}T${time || '00:00'}:00`;
}

export function nextQuarterHour(now = new Date()) {
	const d = new Date(now);
	d.setSeconds(0, 0);
	d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
	return d;
}

/** Where a new event starts: the picked hour on that day, else the next quarter hour. */
export function addStart(day, hour = null, now = new Date()) {
	const base = toDate(day) || new Date(now);
	if (hour != null) return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, 0);
	const q = nextQuarterHour(now);
	return new Date(base.getFullYear(), base.getMonth(), base.getDate(), q.getHours(), q.getMinutes());
}

// Repeats, as the backend stores them (repeatDays)
export const REPEATS = [
	{ key: 'never', label: 'Never', days: 0 },
	{ key: 'daily', label: 'Daily', days: 1 },
	{ key: 'weekly', label: 'Weekly', days: 7 },
	{ key: 'monthly', label: 'Monthly', days: 30 },
	{ key: 'yearly', label: 'Yearly', days: 365 },
];
const EVERY = { 1: 'Every day', 7: 'Every week', 30: 'Every month', 365: 'Every year' };

/** The repeat choice for a stored repeatDays; 'custom' for one the choices don't cover. */
export function repeatKey(days) {
	const n = Number(days) || 0;
	return REPEATS.find(r => r.days === n)?.key ?? 'custom';
}

export function repeatText(days) {
	const n = Number(days) || 0;
	return n ? EVERY[n] ?? `Every ${n} days` : '';
}

/** "Thu 15 Oct", with the year when it isn't this year. */
export function formatDay(v, now = new Date()) {
	const d = toDate(v);
	if (!d) return '';
	const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
		.formatToParts(d).map(p => [p.type, p.value]));
	return [parts.weekday, parts.day, parts.month, d.getFullYear() !== now.getFullYear() ? parts.year : null].filter(Boolean).join(' ');
}

/** "Thu 15 Oct · 09:10" */
export function formatWhen(v, now = new Date()) {
	const d = toDate(v);
	return d ? `${formatDay(d, now)} · ${localParts(d).time}` : '';
}

/** A deadline's day and how far away it is; null without one. */
export function deadlineInfo(deadline, now = new Date()) {
	const d = toDate(dateInput(deadline));
	if (!d) return null;
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const days = Math.round((d - today) / DAY);
	const hint = days === 0 ? 'today' : days === 1 ? 'tomorrow' : days === -1 ? 'yesterday'
		: days > 1 ? `in ${days} days` : `${-days} days ago`;
	return { day: formatDay(d, now), hint, overdue: days < 0 };
}

const plusDays = (now, n) => dateInput(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n));

export const QUICK_DEADLINES = [
	{ label: 'Today', date: (now = new Date()) => plusDays(now, 0) },
	{ label: 'Tomorrow', date: (now = new Date()) => plusDays(now, 1) },
	{ label: 'Next week', date: (now = new Date()) => plusDays(now, 7) },
];
