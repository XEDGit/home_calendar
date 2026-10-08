// The app's tab paths (/calendar, /todo, ...). The whole app is one page that
// swaps views and writes the view's name into the address bar, so these URLs
// must load that page too; otherwise a refresh on any tab is a 404.
// Keep in sync with `pageNames` in routes/+page.svelte.
const VIEWS = ['home', 'calendar', 'chores', 'addEvent', 'addChore', 'settings', 'todo', 'stats', 'addTodo', 'automations', 'addAutomation', 'assistant'];

/** @param {string} param */
export function match(param) {
	return VIEWS.includes(param);
}
