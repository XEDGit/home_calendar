// Browser-side calls for the assistant. Each resolves { ok, status, data } and
// never throws, so callers can show the server's message (429, 503, 409…).
async function call(path, options) {
	try {
		const res = await fetch(path, options);
		const data = await res.json().catch(() => ({}));
		return { ok: res.ok, status: res.status, data };
	} catch {
		return { ok: false, status: 0, data: { error: 'Could not reach the server' } };
	}
}

const post = (path, body) => call(path, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(body),
});

export const sendMessage = ({ message, conversationId = null }) => post('/api/assistant', { message, conversationId });
export const listConversations = () => call('/api/assistantConversations');
export const getConversation = (id, { read = true } = {}) =>
	call(`/api/assistantConversation?id=${encodeURIComponent(id)}${read ? '' : '&read=0'}`);
export const deleteConversation = (id) => post('/api/assistantDeleteConversation', { id });
export const cancelMessage = (messageId) => post('/api/assistantCancel', { messageId });
export const confirmPlan = (messageId, refs) => post('/api/assistantConfirm', { messageId, refs });
export const rejectPlan = (messageId) => post('/api/assistantPlanCancel', { messageId });
