import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, READ_TOOLS, createExecutor } from '../assistantTools.js';

const names = (list) => list.map((t) => t.function.name);

test('chat gets the web tools and create_automation', () => {
	for (const n of ['web_search', 'fetch_page', 'create_automation']) assert.ok(names(TOOLS).includes(n), n);
});

test('READ_TOOLS contains no tool that can change data', () => {
	const read = names(READ_TOOLS);
	assert.ok(read.includes('web_search') && read.includes('fetch_page') && read.includes('today_recap'));
	for (const n of read) assert.doesNotMatch(n, /^(add|update|delete|sign|skip|create)_/, n);
});

test('create_automation validates and stages a POST /automations', async () => {
	const exec = createExecutor({ cookie: '', userId: 'u1', stage: true });
	assert.ok((await exec.call('create_automation', { name: 'News', prompt: 'x', every: 5, unit: 'minutes' })).error);
	const ok = await exec.call('create_automation', { name: ' News ', prompt: 'Top headlines', every: 1, unit: 'days', at: '08:00' });
	assert.equal(ok.staged, true);
	assert.equal(ok.summary, 'Create automation "News" daily at 08:00');
	assert.equal(exec.staged[0].path, '/automations');
	assert.deepEqual(exec.staged[0].body, { name: 'News', prompt: 'Top headlines', every: 1, unit: 'days', at: '08:00', enabled: true });
});

test('fetch_page results carry the untrusted-content note', async () => {
	const exec = createExecutor({ cookie: '', userId: 'u1', stage: true });
	const out = await exec.call('fetch_page', { url: 'http://127.0.0.1/' });
	assert.equal(out.error, 'blocked');
	assert.match(out.note, /untrusted/i);
});
