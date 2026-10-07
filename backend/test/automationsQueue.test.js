import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SECRET ||= 'x'.repeat(32);
const { interruptedAutomations } = await import('../automations.js');

test('only automations without a queued or running job are recorded as interrupted', async () => {
	const stuck = [{ _id: 'a1' }, { _id: 'a2' }, { _id: 'a3' }];
	const active = new Set(['a2']);
	const out = await interruptedAutomations(stuck, async (id) => active.has(id));
	assert.deepEqual(out.map(d => d._id), ['a1', 'a3']);
});
