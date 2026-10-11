const { test, afterEach } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const R = await import('./requests.js');

// The page's fetch, answering every request with `body`
const realFetch = globalThis.fetch;
function answer(body, status = 200) {
	globalThis.fetch = async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
afterEach(() => (globalThis.fetch = realFetch));

test('tags and todos come back as lists', async () => {
	answer(['groceries', 'house']);
	assert.deepEqual(await R.getTags(), ['groceries', 'house']);
	answer([{ _id: 't1', title: 'Buy bin bags' }]);
	assert.deepEqual(await R.getTodos(), [{ _id: 't1', title: 'Buy bin bags' }]);
});

// A new household has no member picked yet, so no `user` cookie, and the
// backend answers these member-only lists with an error object
test('an error instead of a list is an empty list', async () => {
	answer({ error: 'Missing authorization' }, 400);
	assert.deepEqual(await R.getTags(), []);
	assert.deepEqual(await R.getTodos(), []);
});
