const { test } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const I = await import('./intro.js');

const members = (n) => Array.from({ length: n }, (_, i) => ({ _id: `u${i}`, name: `M${i}`, color: '#000000' }));
const rooms = (n) => Array.from({ length: n }, (_, i) => ({ _id: `r${i}`, name: `R${i}` }));

test('a household of one skips "who is on this device"', () => {
	assert.deepEqual(I.introSteps({ members: members(1), rooms: rooms(1) }),
		['welcome', 'members', 'theme', 'rooms', 'chore', 'done']);
});

test('several members pick who is on this device', () => {
	assert.deepEqual(I.introSteps({ members: members(3), rooms: rooms(1) }),
		['welcome', 'members', 'device', 'theme', 'rooms', 'chore', 'done']);
});

test('without rooms there is no first chore to add', () => {
	assert.deepEqual(I.introSteps({ members: members(1), rooms: [] }),
		['welcome', 'members', 'theme', 'rooms', 'done']);
});

test('before anyone is added the steps still read as for one member', () => {
	assert.deepEqual(I.introSteps({ members: [], rooms: [] }),
		['welcome', 'members', 'theme', 'rooms', 'done']);
});

test('cleanName trims and collapses spaces', () => {
	assert.equal(I.cleanName('  Living   room '), 'Living room');
	assert.equal(I.cleanName(''), '');
	assert.equal(I.cleanName(undefined), '');
});

test('findByName ignores case and spacing', () => {
	const list = [{ _id: 'r1', name: 'Kitchen' }, { _id: 'r2', name: 'Living room' }];
	assert.equal(I.findByName(list, ' kitchen ')?._id, 'r1');
	assert.equal(I.findByName(list, 'LIVING  ROOM')?._id, 'r2');
	assert.equal(I.findByName(list, 'Garage'), undefined);
});

test('nextColor picks the first swatch nobody has yet', () => {
	const [a, b, c] = I.MEMBER_COLORS;
	assert.equal(I.nextColor([]), a);
	assert.equal(I.nextColor([{ color: a }]), b);
	assert.equal(I.nextColor([{ color: a.toUpperCase() }, { color: b }]), c);
	// All taken: start again from the first
	assert.equal(I.nextColor(I.MEMBER_COLORS.map((color) => ({ color }))), a);
});

test('chore repeats are stored the way the chore form stores them', () => {
	// nextTime: 1–30 = every N days, 30 + N = every N months
	const byLabel = Object.fromEntries(I.CHORE_REPEATS.map((r) => [r.label, r.nextTime]));
	assert.equal(byLabel['Every day'], 1);
	assert.equal(byLabel['Every week'], 7);
	assert.equal(byLabel['Every 2 weeks'], 14);
	assert.equal(byLabel['Every month'], 31);
	assert.ok(I.CHORE_REPEATS.every((r) => (r.nextTime >= 1 && r.nextTime <= 30) || (r.nextTime > 30 && r.nextTime <= 42)));
});

test('a first chore is the body POST /chores expects', () => {
	const picked = [{ _id: 'r1', name: 'Kitchen' }];
	assert.deepEqual(I.choreBody('  Take out   the bins ', picked, 7), {
		name: 'Take out the bins', rooms: [{ _id: 'r1', name: 'Kitchen' }], nextTime: 7, timeMeasure: 'days', notes: '',
	});
});

test('the step count stays the same whichever steps apply', () => {
	assert.equal(I.PHASES.length, 6);
	// "Who's on this device" belongs to "Who lives here"
	assert.equal(I.phaseOf('device'), I.phaseOf('members'));
	assert.deepEqual(['welcome', 'members', 'theme', 'rooms', 'chore', 'done'].map(I.phaseOf), [0, 1, 2, 3, 4, 5]);
	for (const s of I.introSteps({ members: [{}, {}], rooms: [{}] })) assert.ok(I.phaseOf(s) >= 0, s);
});
