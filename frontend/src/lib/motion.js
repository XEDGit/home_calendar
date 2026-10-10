// Motion system. Timings and curves mirror the motion tokens in
// $lib/design/tokens.css; keep the two in sync.
//
// Svelte transitions and the Web Animations API run in JS, so the CSS
// reduced-motion rule in general.css can't reach them. Everything here
// collapses to instant when the user asks for reduced motion.
import { tick } from 'svelte';
import { fade, fly, slide } from 'svelte/transition';
import { flip } from 'svelte/animate';
import { quintIn, quintOut } from 'svelte/easing';
import { networkIdle } from '$lib/requests';

export const DUR = { instant: 100, fast: 130, base: 200, slow: 260, screen: 360 };
export const EASE = {
	out: 'cubic-bezier(0.22, 1, 0.36, 1)',
	in: 'cubic-bezier(0.64, 0, 0.78, 0)'
};

export function reducedMotion() {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A duration that collapses to 0 under reduced motion. */
export function ms(duration) {
	return reducedMotion() ? 0 : duration;
}

// While a View Transition captures its new state, that state is what gets
// animated; element-level intros and height morphs inside it would double
// up, so they sit it out. Content arriving after the capture (late data)
// still eases in.
let capturing = false;

// ── Svelte transitions ──────────────────────────────────────────────────────

/** Entrance: short rise + fade. */
export function reveal(node, { y = 6, duration = DUR.base, delay = 0 } = {}) {
	return fly(node, {
		y,
		opacity: 0,
		duration: capturing ? 0 : ms(duration),
		delay: capturing ? 0 : ms(delay),
		easing: quintOut
	});
}

/** Exit: quick fade. Pairs with `move` so siblings close the gap. */
export function vanish(node, { duration = DUR.fast } = {}) {
	return fade(node, { duration: ms(duration), easing: quintIn });
}

/** Expand/collapse in place (panels, inline messages, date pickers). */
export function expand(node, { duration } = {}, { direction } = {}) {
	return slide(node, {
		duration: ms(duration ?? (direction === 'out' ? DUR.fast : DUR.base)),
		easing: direction === 'out' ? quintIn : quintOut
	});
}

/**
 * Resolves once a short exit (a panel folding away) has played, so a list
 * reshuffle can follow it instead of colliding with it.
 */
export function afterExit() {
	return new Promise((resolve) => setTimeout(resolve, ms(DUR.fast) + 20));
}

/** Keyed-list reordering: items glide to their new place. */
export function move(node, fromTo, { duration = DUR.slow } = {}) {
	return flip(node, fromTo, { duration: ms(duration), easing: quintOut });
}

// ── View Transitions ────────────────────────────────────────────────────────

let seq = 0;

/**
 * Apply a DOM update inside a View Transition when the browser supports it,
 * falling back to an instant update. `scope` decides which elements morph and
 * `dir` which way content travels (both read by general.css). With `settle`,
 * the new state waits up to that many ms for the requests it kicked off, so a
 * view arrives with its data instead of popping it in afterwards.
 * Resolves once the DOM has been updated.
 */
export function viewTransition(update, { scope = 'page', dir = 'none', settle = 0 } = {}) {
	const run = async () => {
		await update();
		await tick();
		if (settle) {
			await networkIdle(settle);
			await tick();
		}
	};

	if (typeof document === 'undefined' || !document.startViewTransition || reducedMotion()) {
		return (async () => {
			await update();
			await tick();
		})();
	}

	const root = document.documentElement;
	const id = ++seq;
	root.dataset.vt = scope;
	root.dataset.vtDir = dir;
	capturing = true;

	const transition = document.startViewTransition(run);
	transition.updateCallbackDone.finally(() => {
		if (id === seq) capturing = false;
	});
	transition.finished.finally(() => {
		if (id !== seq) return;
		delete root.dataset.vt;
		delete root.dataset.vtDir;
	});
	return transition.updateCallbackDone;
}

// ── Height continuity ───────────────────────────────────────────────────────

/**
 * Animate an element's height across an explicit content swap (view/edit
 * toggles). Call before the change; call the returned function after the DOM
 * has updated.
 */
export function morphHeight(node) {
	if (!node || reducedMotion()) return () => {};
	const from = node.getBoundingClientRect().height;
	return () => {
		const to = node.getBoundingClientRect().height;
		if (Math.abs(to - from) < 1) return;
		const overflow = node.style.overflow;
		node.style.overflow = 'hidden';
		const anim = node.animate([{ height: `${from}px` }, { height: `${to}px` }], {
			duration: DUR.base,
			easing: EASE.out
		});
		const restore = () => (node.style.overflow = overflow);
		anim.onfinish = restore;
		anim.oncancel = restore;
	};
}

/**
 * Svelte action: whenever the container's content grows or shrinks (data
 * arriving, rows leaving), animate its height so whatever sits below glides
 * instead of jumping. Put it on a plain wrapper whose only child holds the
 * content.
 */
export function autoHeight(node) {
	const inner = node.firstElementChild;
	if (!inner || typeof ResizeObserver === 'undefined') return {};
	// Keep child margins inside the measured box
	if (getComputedStyle(inner).display === 'block') inner.style.display = 'flow-root';

	let last = inner.getBoundingClientRect().height;
	let anim;
	// Inside a hidden screen (a tab kept alive in the background) there is
	// nothing to animate, and when it shows again it appears as it is
	// instead of growing in from nothing
	let changedWhileHidden = !node.getClientRects().length;

	const ro = new ResizeObserver(() => {
		if (!node.getClientRects().length) {
			changedWhileHidden = true;
			return;
		}
		const next = inner.getBoundingClientRect().height;
		if (changedWhileHidden) {
			changedWhileHidden = false;
			last = next;
			return;
		}
		if (Math.abs(next - last) < 1) return;
		// Mid-animation, start from where the box is right now
		const from = anim ? node.getBoundingClientRect().height : last;
		last = next;
		anim?.cancel();
		if (reducedMotion() || capturing) return;

		node.style.overflow = 'hidden';
		anim = node.animate([{ height: `${from}px` }, { height: `${next}px` }], {
			duration: DUR.slow,
			easing: EASE.out
		});
		anim.onfinish = () => {
			node.style.overflow = '';
			anim = undefined;
		};
	});
	ro.observe(inner);

	return {
		destroy() {
			ro.disconnect();
			anim?.cancel();
		}
	};
}

// ── Dialogs ─────────────────────────────────────────────────────────────────

/**
 * Svelte action for a native <dialog class="dialog">: opens it modally and
 * routes every close (close button, Escape, backdrop click, closeDialog())
 * through a short exit animation before the real close. The enter animation
 * is pure CSS (@starting-style in general.css).
 *
 * `{ lockBackdrop: true }` ignores backdrop clicks (a form with unsaved
 * changes); Escape and closeDialog() still close.
 */
export function modalDialog(node, options = {}) {
	let closing = false;
	let opts = options || {};

	function close() {
		if (closing || !node.open) return;
		closing = true;
		node.classList.add('closing');
		const finish = () => {
			node.removeEventListener('transitionend', onEnd);
			clearTimeout(timer);
			if (node.open) node.close();
		};
		const onEnd = (e) => {
			if (e.target === node && e.propertyName === 'opacity') finish();
		};
		node.addEventListener('transitionend', onEnd);
		const timer = setTimeout(finish, ms(DUR.fast) + 60);
	}

	function onCancel(e) {
		e.preventDefault();
		close();
	}

	// Backdrop clicks land on the <dialog> itself, outside its box.
	// Keyboard-activated clicks report (0,0), so require the dialog as target.
	function onClick(e) {
		if (e.target !== node || opts.lockBackdrop) return;
		const r = node.getBoundingClientRect();
		const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
		if (!inside) close();
	}

	node.addEventListener('cancel', onCancel);
	node.addEventListener('click', onClick);
	node.addEventListener('dialog:close', close);
	node.showModal();

	return {
		update(next) {
			opts = next || {};
		},
		destroy() {
			node.removeEventListener('cancel', onCancel);
			node.removeEventListener('click', onClick);
			node.removeEventListener('dialog:close', close);
		}
	};
}

/** Close a dialog managed by `modalDialog`, with its exit animation. */
export function closeDialog(node) {
	node?.dispatchEvent(new CustomEvent('dialog:close'));
}
