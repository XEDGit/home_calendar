// When events happen, and their repeats.
//
// Times without a zone ("2026-10-15T09:10:00", what the event form stores)
// are wall-clock time in the household's zone (TZ, the one the assistant
// uses too), not the server's UTC clock. Repeats step whole days on that
// wall clock, so a weekly 09:10 stays 09:10 across a DST change.
import { TZ } from './assistantTools.js';

const DAY = 86400000;
const MAX_REPEATS = 1000; // per series per request
const NAIVE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;

const clock = new Intl.DateTimeFormat('en-US', {
	timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
	hour: '2-digit', minute: '2-digit', second: '2-digit',
});

// What TZ's wall clock reads at instant t, as UTC-based ms
function wallAt(t) {
	const p = Object.fromEntries(clock.formatToParts(new Date(t)).map(x => [x.type, x.value]));
	return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}
const offsetAt = (t) => wallAt(t) - Math.floor(t / 1000) * 1000;

// The instant TZ's wall clock reads `wall`. The second pass settles the
// offset when the first guess lands on the other side of a DST change.
function fromWall(wall) {
	return new Date(wall - offsetAt(wall - offsetAt(wall)));
}

/** A stored `when` as an instant, or null when it can't be read. */
export function parseWhen(when) {
	if (when instanceof Date) return isNaN(when) ? null : new Date(when);
	const s = String(when ?? '').trim();
	const m = NAIVE.exec(s);
	if (m) return fromWall(Date.UTC(m[1], m[2] - 1, m[3], m[4] || 0, m[5] || 0, m[6] || 0));
	if (!s) return null;
	const d = new Date(s);
	return isNaN(d) ? null : d;
}

/** A copy of a stored event with `when` as an ISO instant (as is when unreadable). */
export function withInstant(event) {
	const at = parseWhen(event.when);
	return at ? { ...event, when: at.toISOString() } : event;
}

/**
 * The events and repeats that fall in [start, end], each with `when` as an
 * ISO instant: whoever reads them (the page, the assistant's tools on this
 * UTC server) gets the same moment. Repeats also carry `isOccurrence`,
 * `originalEventId` and `originalEventDate` (the series' stored when).
 */
export function expandEvents(events, start, end) {
	const out = [];
	for (const event of events) {
		const first = parseWhen(event.when);
		if (!first) continue;
		const step = Number(event.repeatDays) || 0;
		if (step <= 0) {
			if (first >= start && first <= end) out.push({ ...event, when: first.toISOString() });
			continue;
		}
		const wall = wallAt(first.getTime());
		// Jump close to the range, then walk; one step back covers DST's hour
		let k = Math.max(0, Math.floor((start - first) / (step * DAY)) - 1);
		for (let n = 0; n < MAX_REPEATS; k++) {
			const at = fromWall(wall + k * step * DAY);
			if (at > end) break;
			if (at >= start) {
				out.push({ ...event, when: at.toISOString(), isOccurrence: true, originalEventId: event._id, originalEventDate: event.when });
				n++;
			}
		}
	}
	return out;
}
