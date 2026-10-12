// A chore's interval lives in nextTime/repetition: 1-30 are days, 31-42 are
// 1-12 months. daysNextTime is the countdown in real days (months differ in
// length), timeMeasure the unit the UI shows.
export function calcNextTimeDays(newChore, now = new Date()) {
	newChore.daysNextTime = newChore.nextTime;

	if (newChore.nextTime > 30) {
		let currentDate = new Date(now);
		let targetDate = new Date(currentDate);
		let monthsToAdd = Math.round(newChore.nextTime - 30);
		targetDate.setMonth(currentDate.getMonth() + monthsToAdd);
		newChore.daysNextTime = Math.round((targetDate - currentDate) / (1000 * 60 * 60 * 24));
	}

	if (newChore.nextTime == 1) {
		newChore.timeMeasure = 'day';
	} else if (newChore.nextTime < 31) {
		newChore.timeMeasure = 'days';
	} else if (newChore.nextTime == 31) {
		newChore.timeMeasure = 'month';
	} else if (newChore.nextTime > 31) {
		newChore.timeMeasure = 'months';
	}
}

// The fields that restart a chore's countdown from today, as if it had just
// been done, without recording anyone doing it (back from a holiday).
// Rooms done before count as not done. null when the chore has no interval.
export function resetChore(chore, now = new Date()) {
	if (!(Number(chore.repetition) > 0)) return null;
	const fields = { nextTime: chore.repetition };
	calcNextTimeDays(fields, now);
	fields.rooms = (chore.rooms || []).map(room => ({ ...room, done: false }));
	return fields;
}
