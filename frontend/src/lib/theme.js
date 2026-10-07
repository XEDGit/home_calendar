// Per-member colour themes. A theme is a two-colour palette: `primary`
// (structure and ink: nav, borders, text, active fills) and `paper` (every
// surface at rest, text on primary). Everything else in tokens.css derives
// from the pair.
//
// Every palette keeps primary/paper at 4.5:1 or more both ways (the UI
// inverts them on hover), and teal body ink at 11:1 or more on the paper.
// Check any new palette against both before adding it.
//
// This file is imported by hooks.server.js too (first-paint theming), so it
// must not touch the DOM at import time.

export const THEMES = [
	{ id: 'rose', name: 'Rose & Cream', primary: '#8F5C66', paper: '#FFEAD0' },
	{ id: 'sage', name: 'Sage & Linen', primary: '#4E6B57', paper: '#F2EEE1' },
	{ id: 'denim', name: 'Denim & Oat', primary: '#3F5B7C', paper: '#F4EEE2' },
	{ id: 'plum', name: 'Plum & Blush', primary: '#6D4A7C', paper: '#F7ECEE' },
	{ id: 'olive', name: 'Olive & Honey', primary: '#655D2C', paper: '#FAF0D2' },
	{ id: 'slate', name: 'Slate & Bone', primary: '#4A515C', paper: '#F0ECE5' }
];

export const DEFAULT_THEME = 'rose';

/** The theme with this id, or the default for anything unknown. */
export function themeById(id) {
	return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME);
}

/** Inline style that sets a theme's two colours (used on <html>). */
export function themeStyle(theme) {
	return `--primary: ${theme.primary}; --paper: ${theme.paper};`;
}

/**
 * Apply a theme to the page and remember it in a cookie, so the server can
 * paint it on the first frame of the next load (no flash of the default).
 */
export function applyTheme(id) {
	const theme = themeById(id);
	const root = document.documentElement;
	root.dataset.theme = theme.id;
	root.style.setProperty('--primary', theme.primary);
	root.style.setProperty('--paper', theme.paper);
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.paper);
	document.cookie = `theme=${theme.id}; path=/; max-age=31536000; samesite=lax`;
	return theme;
}

/** The active primary colour, for canvas drawing (charts) that can't read CSS vars. */
export function currentPrimary() {
	if (typeof document === 'undefined') return themeById(DEFAULT_THEME).primary;
	return (
		getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() ||
		themeById(DEFAULT_THEME).primary
	);
}
