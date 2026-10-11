// The welcome a new household walks through (Intro.svelte): which steps
// apply, the suggestions it offers, and the shapes it saves.

/**
 * The steps, in order, for what the household has so far. "Who's on this
 * device" only asks when there's more than one member; the first chore
 * needs a room to belong to.
 */
export function introSteps({ members = [], rooms = [] } = {}) {
	return [
		'welcome',
		'members',
		...(members.length > 1 ? ['device'] : []),
		'theme',
		'rooms',
		...(rooms.length ? ['chore'] : []),
		'done',
	];
}

// What the step count and progress line show: the same six whichever steps
// apply. "Who's on this device" is part of "Who lives here"; a skipped
// chore step just moves the line on.
export const PHASES = ['welcome', 'members', 'theme', 'rooms', 'chore', 'done'];

export function phaseOf(step) {
	return PHASES.indexOf(step === 'device' ? 'members' : step);
}

/** A typed name, trimmed, with runs of spaces made one. */
export function cleanName(name) {
	return String(name ?? '').trim().replace(/\s+/g, ' ');
}

/** The entry in `list` with this name, ignoring case and spacing. */
export function findByName(list, name) {
	const key = cleanName(name).toLowerCase();
	return list.find((item) => cleanName(item.name).toLowerCase() === key);
}

// Member colours mark who did what (chores, stats); far enough apart to
// tell at a glance. Any colour can still be picked.
export const MEMBER_COLORS = ['#c0504d', '#e08a3c', '#c9a227', '#5f9a48', '#3a8f8a', '#4a74b5', '#7b5ea7', '#b5578f'];
export const MEMBER_COLOR_NAMES = ['Red', 'Orange', 'Mustard', 'Green', 'Teal', 'Blue', 'Purple', 'Pink'];

/** The first swatch no member has yet (the first again once all are taken). */
export function nextColor(members) {
	const used = new Set(members.map((m) => String(m.color || '').toLowerCase()));
	return MEMBER_COLORS.find((c) => !used.has(c)) ?? MEMBER_COLORS[0];
}

export const ROOM_SUGGESTIONS = ['Kitchen', 'Bathroom', 'Living room', 'Bedroom', 'Laundry', 'Garden', 'Hallway'];

export const CHORE_SUGGESTIONS = ['Take out the bins', 'Vacuum', 'Clean the bathroom', 'Do the laundry', 'Water the plants'];

// As the chore form stores a repeat: nextTime 1–30 is every N days,
// 30 + N every N months
export const CHORE_REPEATS = [
	{ label: 'Every day', nextTime: 1 },
	{ label: 'Every 3 days', nextTime: 3 },
	{ label: 'Every week', nextTime: 7 },
	{ label: 'Every 2 weeks', nextTime: 14 },
	{ label: 'Every month', nextTime: 31 },
];

/** The body POST /chores takes, as the chore form sends it. */
export function choreBody(name, rooms, nextTime) {
	return { name: cleanName(name), rooms, nextTime, timeMeasure: 'days', notes: '' };
}
