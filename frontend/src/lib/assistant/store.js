import { writable, get } from 'svelte/store';
import * as api from './api.js';

// Assistant state shared by the home panel and the Assistant tab: the
// member's conversation list, the conversations loaded so far, and one live
// event stream per page. The server is the source of truth; events only make
// the open pages live, and every (re)connect reloads from the server.

const UNAVAILABLE = 'The assistant is unavailable right now';
// Server-side failures show one plain message; 4xx answers (queue full, rate
// limit, conflicts) carry the backend's own words.
const errorText = (r) => (r.status === 0 || r.status >= 500 ? UNAVAILABLE : r.data?.error || UNAVAILABLE);

export const conversations = writable([]);
export const unreadCount = writable(0);
export const threads = writable({});
export const listLoaded = writable(false);
export const selected = writable(undefined);

let source = null;
let member = null;
let retryTimer = null;
const RETRY_MIN = 5000;
const RETRY_MAX = 5 * 60 * 1000;
let retryDelay = RETRY_MIN;
const pending = new Map(); // messageId → events that arrived before the message
const visible = new Map(); // 'home' | 'tab' → conversationId shown there
const changeListeners = new Set();

function uiPlan(plan) {
	if (!plan) return null;
	const results = new Map((plan.results || []).map(r => [r.ref, r]));
	return {
		...plan,
		actions: plan.actions.map(a => ({
			...a,
			checked: true,
			status: results.get(a.ref)?.status ?? (plan.state === 'rejected' ? 'skipped' : null),
			error: results.get(a.ref)?.error ?? null,
		})),
	};
}

const uiMessage = (m) => ({ ...m, ahead: m.ahead ?? null, plan: uiPlan(m.plan) });

function householdChanged() {
	for (const fn of changeListeners) fn();
}

export function onHouseholdChange(fn) {
	changeListeners.add(fn);
	return () => changeListeners.delete(fn);
}

export function setVisible(key, conversationId) {
	const previous = visible.get(key);
	if (conversationId) visible.set(key, conversationId);
	else visible.delete(key);
	// An answer that finished while this view was hidden is read once it is looked at again
	if (conversationId && conversationId !== previous && get(conversations).find(c => c._id === conversationId)?.unread) open(conversationId);
}

const isVisible = (id) => [...visible.values()].includes(id);

export function connect(user) {
	if (typeof window === 'undefined' || !user) return;
	if (user === member && source) return;
	disconnect();
	member = user;
	retryDelay = RETRY_MIN;
	conversations.set([]);
	threads.set({});
	unreadCount.set(0);
	listLoaded.set(false);
	open_stream();
}

function open_stream() {
	clearTimeout(retryTimer);
	source = new EventSource('/api/assistantEvents');
	source.onopen = () => { retryDelay = RETRY_MIN; refresh(); };
	source.onmessage = (e) => {
		try { apply(JSON.parse(e.data)); } catch { /* ignore malformed event */ }
	};
	source.onerror = () => {
		// The browser retries by itself unless the stream was refused (401/502):
		// then it stays closed, so try again in a while.
		if (source && source.readyState === EventSource.CLOSED) {
			source = null;
			const who = member;
				const delay = retryDelay;
				retryDelay = Math.min(retryDelay * 2, RETRY_MAX);
				retryTimer = setTimeout(() => { if (member === who) open_stream(); }, delay);
		}
	};
}

export function disconnect() {
	clearTimeout(retryTimer);
	source?.close();
	source = null;
	member = null;
	pending.clear();
}

async function refreshList() {
	const r = await api.listConversations();
	if (!r.ok) return;
	conversations.set(r.data.conversations ?? []);
	unreadCount.set(r.data.unreadCount ?? 0);
	listLoaded.set(true);
}

export async function refresh() {
	await refreshList();
	for (const id of Object.keys(get(threads))) await open(id, { read: isVisible(id) });
}

export async function open(id, { read = true } = {}) {
	const r = await api.getConversation(id, { read });
	if (!r.ok) {
		if (r.status === 404) threads.update(t => { const c = { ...t }; delete c[id]; return c; });
		return null;
	}
	const messages = (r.data.messages ?? []).map(uiMessage);
	for (const m of messages) pending.delete(m._id);
	threads.update(t => {
		// A background reload must not re-tick what the member unticked
		const before = new Map((t[id] || []).filter(m => m.plan?.state === 'review').map(m => [m._id, m.plan]));
		for (const m of messages) {
			const old = before.get(m._id);
			if (!old || m.plan?.state !== 'review') continue;
			const checked = new Map(old.actions.map(a => [a.ref, a.checked]));
			m.plan = { ...m.plan, actions: m.plan.actions.map(a => (checked.has(a.ref) ? { ...a, checked: checked.get(a.ref) } : a)) };
		}
		return { ...t, [id]: messages };
	});
	if (read) conversations.update(list => list.map(c => (c._id === id ? { ...c, unread: false } : c)));
	return messages;
}

function patchMessage(conversationId, messageId, fn) {
	let found = false;
	threads.update(t => {
		const list = t[conversationId];
		if (!list) return t;
		const i = list.findIndex(m => m._id === messageId);
		if (i < 0) return t;
		found = true;
		const copy = [...list];
		copy[i] = fn({ ...copy[i] });
		return { ...t, [conversationId]: copy };
	});
	return found;
}

function applyToMessage(m, ev) {
	switch (ev.type) {
		case 'queue': m.ahead = ev.ahead; break;
		case 'start': m.status = 'running'; m.ahead = 0; break;
		case 'text': m.content = (m.content || '') + ev.text; break;
		case 'tool': m.tools = [...(m.tools || []), { name: ev.name, summary: ev.summary, error: ev.error, staged: ev.staged, done: ev.done }]; break;
		case 'plan': m.plan = uiPlan(ev.plan); break;
		case 'done_actions': m.doneActions = ev.actions; break;
		case 'error': m.error = ev.error; break;
		case 'end': m.status = ev.status; m.content = (m.content || '').trim(); break;
	}
	return m;
}

function apply(ev) {
	if (ev.type === 'unread') { unreadCount.set(ev.count); return; }
	const { conversationId, messageId } = ev;
	if (!conversationId || !messageId) return;
	const hit = patchMessage(conversationId, messageId, m => applyToMessage(m, ev));
	if (!hit) {
		const list = pending.get(messageId) || [];
		list.push(ev);
		pending.set(messageId, list.slice(-200));
	}
	if (ev.type === 'done_actions' || (ev.type === 'plan' && ev.plan.results?.some(r => r.status === 'done'))) householdChanged();
	if (ev.type === 'end') {
		refreshList();
		// Reload what the member is looking at: final text as stored, marks it read
		if (isVisible(conversationId)) open(conversationId);
	}
	if (ev.type === 'queue' || ev.type === 'start') {
		conversations.update(list => list.map(c => (c._id === conversationId ? { ...c, busy: true } : c)));
	}
}

export async function send(text, conversationId = null) {
	const r = await api.sendMessage({ message: text, conversationId });
	if (!r.ok) return { error: errorText(r), status: r.status };
	const { conversationId: cid, messageId, userMessageId, ahead } = r.data;
	if (get(threads)[cid]) {
		let reply = { _id: messageId, role: 'assistant', content: '', status: 'queued', ahead, error: null, tools: [], plan: null, doneActions: null };
		for (const ev of pending.get(messageId) || []) reply = applyToMessage(reply, ev);
		pending.delete(messageId);
		threads.update(t => {
			// An open() snapshot may already hold them: never add an _id twice
			const have = new Set(t[cid].map(m => m._id));
			const add = [];
			if (!have.has(userMessageId)) add.push({ _id: userMessageId, role: 'user', content: text, status: null, tools: [], plan: null });
			if (!have.has(messageId)) add.push(reply);
			return add.length ? { ...t, [cid]: [...t[cid], ...add] } : t;
		});
	} else {
		await open(cid);
	}
	await refreshList();
	return { conversationId: cid };
}

export async function cancel(conversationId, messageId) {
	const r = await api.cancelMessage(messageId);
	if (!r.ok && r.status === 409) await open(conversationId);
}

export function togglePlanAction(conversationId, messageId, ref) {
	patchMessage(conversationId, messageId, m => {
		const plan = { ...m.plan, actions: m.plan.actions.map(a => ({ ...a })) };
		const action = plan.actions.find(a => a.ref === ref);
		action.checked = !action.checked;
		if (!action.checked) {
			// Unticking an action also unticks the ones built on it
			let changed = true;
			while (changed) {
				changed = false;
				for (const a of plan.actions) {
					if (a.checked && a.deps.some(dep => plan.actions.find(x => x.ref === dep && !x.checked))) {
						a.checked = false;
						changed = true;
					}
				}
			}
		}
		m.plan = plan;
		return m;
	});
}

export async function confirm(conversationId, messageId) {
	const message = get(threads)[conversationId]?.find(m => m._id === messageId);
	if (!message?.plan) return {};
	const refs = message.plan.actions.filter(a => a.checked).map(a => a.ref);
	if (!refs.length) return reject(conversationId, messageId);
	patchMessage(conversationId, messageId, m => ({ ...m, plan: { ...m.plan, state: 'running' } }));
	const r = await api.confirmPlan(messageId, refs);
	await open(conversationId, { read: false });
	if (r.ok && (r.data.results ?? []).some(x => x.status === 'done')) householdChanged();
	return r.ok ? {} : { error: errorText(r) };
}

export async function reject(conversationId, messageId) {
	const r = await api.rejectPlan(messageId);
	await open(conversationId, { read: false });
	return r.ok ? {} : { error: errorText(r) };
}

export async function remove(id) {
	const r = await api.deleteConversation(id);
	if (!r.ok) return { error: errorText(r) };
	threads.update(t => { const c = { ...t }; delete c[id]; return c; });
	await refreshList();
	return {};
}
