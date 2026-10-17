<script>
	// A new household's welcome, one step at a time: who lives here, who's
	// on this device, a theme, rooms and a first chore. routes/+page.svelte
	// shows it instead of the tabs while the household has no members.
	// Every step saves as it goes; all of it can be changed later in Settings.
	import { onMount, tick } from 'svelte';
	import { getUsers, getRooms, postFrontend, updateTheme } from '#lib/requests.js';
	import { setCookie } from '#lib/helpers/getCookie.js';
	import { applyTheme, themeById } from '#lib/theme.js';
	import { morphHeight, reveal, vanish, move, viewTransition } from '#lib/motion.js';
	import ThemePicker from '#lib/components/ThemePicker.svelte';
	import {
		introSteps, PHASES, phaseOf, cleanName, findByName, MEMBER_COLORS, MEMBER_COLOR_NAMES, nextColor,
		ROOM_SUGGESTIONS, CHORE_SUGGESTIONS, CHORE_REPEATS, choreBody,
	} from './intro.js';

	export let onDone = () => {};

	const TITLES = {
		welcome: 'Welcome to Home Calendar',
		members: 'Who lives here?',
		device: "Who's using this device?",
		theme: 'Pick your colours',
		rooms: 'Which rooms do you have?',
		chore: 'Add a first chore',
		done: "You're all set",
	};

	const uid = Math.random().toString(36).slice(2, 8);
	const list = (value) => (Array.isArray(value) ? value : []);

	let card, heading, nameInput, roomInput, choreInput;
	let step = 'welcome';
	let members = [];
	let rooms = [];
	let meId = null;
	let theme = '';
	let busy = false;
	let error = '';

	let newName = '';
	let newColor = MEMBER_COLORS[0];
	let nameError = '';
	let newRoom = '';
	let roomError = '';
	let chore = { name: '', rooms: [], nextTime: 7 };
	let choreError = '';
	let addedChore = null;

	$: steps = introSteps({ members, rooms });
	$: at = steps.indexOf(step);
	$: phase = phaseOf(step);
	$: me = members.find((m) => m._id === meId) ?? null;
	$: customColor = !MEMBER_COLORS.includes(String(newColor).toLowerCase());
	// The suggestions first, then rooms the household named itself
	$: roomNames = [...ROOM_SUGGESTIONS, ...rooms.map((r) => r.name).filter((n) => !ROOM_SUGGESTIONS.some((s) => findByName([{ name: s }], n)))];
	// An error says what's still missing, and goes once it's fixed
	const choreProblem = (c) => (!cleanName(c.name) ? 'Give it a name' : !c.rooms.length ? 'Pick at least one room' : '');
	$: if (choreError) choreError = choreProblem(chore);
	$: repeatLabel = CHORE_REPEATS.find((r) => r.nextTime === chore.nextTime)?.label.toLowerCase();

	onMount(async () => {
		// Reopened halfway (a reload before the first member): pick up what's there
		[members, rooms] = (await Promise.all([getUsers(), getRooms()]).catch(() => [[], []])).map(list);
		newColor = nextColor(members);
	});

	async function go(next) {
		if (!next) return;
		const settle = morphHeight(card);
		error = '';
		step = next;
		if (next === 'chore' && rooms.length === 1 && !chore.rooms.length) chore.rooms = [rooms[0]._id];
		await tick();
		settle();
		// The step's title takes focus, so keyboards and screen readers start at the top
		heading?.focus({ preventScroll: true });
		// A long step left the top behind (phones): bring the card's top back
		if (card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: 'start' });
	}

	// One write at a time; a failure stays on the step with a message
	async function attempt(fn) {
		if (busy) return false;
		busy = true;
		error = '';
		try {
			await fn();
			return true;
		} catch {
			error = "Couldn't save that. Check the connection and try again.";
			return false;
		} finally {
			busy = false;
		}
	}

	async function call(endpoint, body) {
		const r = await postFrontend(endpoint, body);
		if (!r || r.error) throw new Error(r?.error || 'failed');
		return r;
	}

	const reloadMembers = async () => (members = list(await getUsers()));
	const reloadRooms = async () => (rooms = list(await getRooms()));

	// ── Members ──
	async function addMember() {
		const name = cleanName(newName);
		nameError = !name ? 'Type a name first' : findByName(members, name) ? `${name} is already on the list` : '';
		if (nameError) {
			nameInput?.focus();
			return false;
		}
		const ok = await attempt(async () => {
			await call('addUser', { name, color: newColor });
			await reloadMembers();
		});
		if (ok) {
			newName = '';
			newColor = nextColor(members);
			nameInput?.focus();
		}
		return ok;
	}

	async function removeMember(m) {
		await attempt(async () => {
			await call('delUser', { id: m._id });
			await reloadMembers();
		});
		if (meId === m._id) meId = null;
	}

	async function membersNext() {
		// A name typed but not added yet counts as added
		if (cleanName(newName) && !(await addMember())) return;
		if (!members.length) {
			nameError = 'Add at least one person';
			nameInput?.focus();
			return;
		}
		if (members.length === 1) pickMe(members[0]._id);
		else if (!me) meId = null;
		go(introSteps({ members, rooms })[at + 1]);
	}

	// ── This device ──
	function pickMe(id) {
		meId = id;
		setCookie('user', id, 1000);
		theme = themeById(members.find((m) => m._id === id)?.theme).id;
	}

	// ── Theme ──
	function pickTheme(id) {
		theme = id;
		viewTransition(() => applyTheme(id), { scope: 'theme', dir: 'fade' });
		attempt(async () => {
			const r = await updateTheme(id);
			if (r?.error) throw new Error(r.error);
		});
	}

	// ── Rooms ──
	async function toggleRoom(name) {
		const room = findByName(rooms, name);
		await attempt(async () => {
			if (room) await call('delRoom', { id: room._id });
			else await call('addRoom', { name: cleanName(name) });
			await reloadRooms();
		});
		chore.rooms = chore.rooms.filter((id) => rooms.some((r) => r._id === id));
	}

	async function addRoom() {
		const name = cleanName(newRoom);
		roomError = !name ? 'Type a room name first' : findByName(rooms, name) ? `${name} is already on the list` : '';
		if (roomError) {
			roomInput?.focus();
			return;
		}
		if (await attempt(async () => { await call('addRoom', { name }); await reloadRooms(); })) {
			newRoom = '';
			roomInput?.focus();
		}
	}

	// ── First chore ──
	async function addChore() {
		const name = cleanName(chore.name);
		choreError = choreProblem(chore);
		if (choreError) {
			if (!name) choreInput?.focus();
			return;
		}
		const picked = rooms.filter((r) => chore.rooms.includes(r._id)).map((r) => ({ _id: r._id, name: r.name }));
		if (await attempt(() => call('addChore', choreBody(name, picked, chore.nextTime)))) {
			addedChore = { name, repeat: repeatLabel };
			go('done');
		}
	}

	function onEnter(e, fn) {
		if (e.key === 'Enter') {
			e.preventDefault();
			fn();
		}
	}
</script>

<section class="intro" aria-labelledby="intro-title-{uid}">
	<div class="card" bind:this={card}>
		<header class="band on-primary">
			<span class="kind">Setting up your household</span>
			<span class="count">Step {phase + 1} of {PHASES.length}</span>
		</header>
		<div class="progress" role="progressbar" aria-label="Setup progress" aria-valuemin="1" aria-valuemax={PHASES.length} aria-valuenow={phase + 1}>
			<span class="fill" style:--done={phase / (PHASES.length - 1)}></span>
		</div>

		<div class="body">
			<h2 class="step-title" id="intro-title-{uid}" tabindex="-1" bind:this={heading}>{TITLES[step]}</h2>

			{#key step}
			<div class="step" in:reveal>
			{#if step === 'welcome'}
				<p class="lead prose">One place for your household's week: whose turn it is, what's coming up, and what still needs doing. Setting up takes about a minute.</p>
				<ul class="tour">
					<li><strong>Home</strong> shows today at a glance.</li>
					<li><strong>Calendar</strong> holds events, one-off or repeating.</li>
					<li><strong>Chores</strong> rotate through rooms, and anyone can sign one off.</li>
					<li><strong>Todo</strong> is a board of things to do, private or shared.</li>
					<li><strong>Assistant</strong> answers questions and makes changes when you ask.</li>
				</ul>

			{:else if step === 'members'}
				<p class="lead prose">Add everyone who lives here. Each person gets a colour, so you can tell at a glance who did what.</p>
				{#if members.length}
					<ul class="members" aria-label="Household members">
						{#each members as m (m._id)}
							<li animate:move in:reveal out:vanish>
								<span class="dot" style:background={m.color} aria-hidden="true"></span>
								<span class="name">{m.name}</span>
								<button type="button" class="remove" aria-label="Remove {m.name}" on:click={() => removeMember(m)} disabled={busy}>Remove</button>
							</li>
						{/each}
					</ul>
				{/if}
				<div class="field">
					<label class="label" for="intro-name-{uid}">{members.length ? 'Add someone else' : 'Your name'}</label>
					<div class="inline">
						<input class="line" id="intro-name-{uid}" bind:this={nameInput} bind:value={newName} maxlength="40"
							placeholder="Name" autocomplete="off" on:input={() => (nameError = '')} on:keydown={(e) => onEnter(e, addMember)}
							aria-invalid={nameError ? 'true' : undefined} aria-describedby={nameError ? `intro-name-error-${uid}` : undefined} />
						<button type="button" class="btn btn-ghost" on:click={addMember} disabled={busy}>Add</button>
					</div>
					{#if nameError}<span class="field-error" id="intro-name-error-{uid}">{nameError}</span>{/if}
				</div>
				<fieldset class="field">
					<legend class="label">Their colour</legend>
					<div class="colors">
						{#each MEMBER_COLORS as c, i}
							<label class="color" style:--c={c}>
								<input type="radio" name="intro-color-{uid}" value={c} bind:group={newColor} aria-label={MEMBER_COLOR_NAMES[i]} />
								<span aria-hidden="true"></span>
							</label>
						{/each}
						<label class="color custom" class:on={customColor} style:--c={customColor ? newColor : 'transparent'}>
							<input type="color" bind:value={newColor} aria-label="Another colour" />
							<span aria-hidden="true">{customColor ? '' : '+'}</span>
						</label>
					</div>
				</fieldset>

			{:else if step === 'device'}
				<p class="lead prose">Tap your name. This device remembers it, and your theme and assistant chats follow you.</p>
				<div class="people" role="radiogroup" aria-label="Who's using this device">
					{#each members as m (m._id)}
						<label class="person">
							<input type="radio" name="intro-me-{uid}" value={m._id} checked={meId === m._id} on:change={() => pickMe(m._id)} />
							<span><span class="dot" style:background={m.color} aria-hidden="true"></span>{m.name}</span>
						</label>
					{/each}
				</div>

			{:else if step === 'theme'}
				<p class="lead prose">{me ? `${me.name}, choose` : 'Choose'} the two colours the app is drawn in. It follows you to every device; everyone picks their own.</p>
				<ThemePicker current={theme} label="Theme for {me?.name || 'you'}" onPick={pickTheme} />

			{:else if step === 'rooms'}
				<p class="lead prose">Chores are done room by room. Tap the rooms you have, and add any others.</p>
				<div class="chips" role="group" aria-label="Rooms">
					{#each roomNames as name (name)}
						{@const on = !!findByName(rooms, name)}
						<button type="button" class="chip" class:active={on} aria-pressed={on} on:click={() => toggleRoom(name)} disabled={busy}>{on ? '✓ ' : ''}{name}</button>
					{/each}
				</div>
				<div class="field">
					<label class="label" for="intro-room-{uid}">Another room</label>
					<div class="inline">
						<input class="line" id="intro-room-{uid}" bind:this={roomInput} bind:value={newRoom} maxlength="40"
							placeholder="Office, garage…" autocomplete="off" on:input={() => (roomError = '')} on:keydown={(e) => onEnter(e, addRoom)}
							aria-invalid={roomError ? 'true' : undefined} aria-describedby={roomError ? `intro-room-error-${uid}` : undefined} />
						<button type="button" class="btn btn-ghost" on:click={addRoom} disabled={busy}>Add</button>
					</div>
					{#if roomError}<span class="field-error" id="intro-room-error-{uid}">{roomError}</span>{/if}
				</div>

			{:else if step === 'chore'}
				<p class="lead prose">A chore repeats on its own and shows whose turn it is. Start with one; the Chores tab holds the rest.</p>
				<div class="field">
					<label class="label" for="intro-chore-{uid}">Chore</label>
					<input class="line" id="intro-chore-{uid}" bind:this={choreInput} bind:value={chore.name} maxlength="80"
						placeholder="Take out the bins" autocomplete="off" on:keydown={(e) => onEnter(e, addChore)} />
					<div class="chips" role="group" aria-label="Suggestions">
						{#each CHORE_SUGGESTIONS as s}
							<button type="button" class="chip" class:active={cleanName(chore.name) === s} aria-pressed={cleanName(chore.name) === s} on:click={() => (chore.name = s)}>{s}</button>
						{/each}
					</div>
				</div>
				<fieldset class="field">
					<legend class="label">In which rooms</legend>
					<div class="chips">
						{#each rooms as r (r._id)}
							<label class="pick"><input type="checkbox" value={r._id} bind:group={chore.rooms} /><span class="chip">{r.name}</span></label>
						{/each}
					</div>
				</fieldset>
				<fieldset class="field">
					<legend class="label">How often</legend>
					<div class="chips">
						{#each CHORE_REPEATS as r}
							<label class="pick"><input type="radio" name="intro-repeat-{uid}" value={r.nextTime} bind:group={chore.nextTime} /><span class="chip">{r.label}</span></label>
						{/each}
					</div>
				</fieldset>
				{#if choreError}<p class="field-error" role="alert">{choreError}</p>{/if}

			{:else if step === 'done'}
				<p class="lead prose">Here's your household. Everything can be changed later in Settings.</p>
				<ul class="summary">
					<li>
						<strong>{members.length === 1 ? '1 person' : `${members.length} people`}:</strong>
						{#each members as m, i}<span class="who"><span class="dot" style:background={m.color} aria-hidden="true"></span>{m.name}</span>{i < members.length - 1 ? ', ' : ''}{/each}
					</li>
					{#if rooms.length}
						<li><strong>{rooms.length === 1 ? '1 room' : `${rooms.length} rooms`}:</strong> {rooms.map((r) => r.name).join(', ')}</li>
					{:else}
						<li><strong>No rooms yet:</strong> add them any time in Settings</li>
					{/if}
					{#if addedChore}<li><strong>First chore:</strong> {addedChore.name}, {addedChore.repeat}</li>{/if}
				</ul>
				<p class="lead prose">Others in the household log in with the same household login and tap their name.</p>
			{/if}
			</div>
			{/key}
		</div>

		<footer class="foot">
			{#if error}<p class="foot-error" role="alert">{error}</p>{/if}
			{#if at > 0 && step !== 'done'}
				<button type="button" class="btn btn-ghost" on:click={() => go(steps[at - 1])} disabled={busy}>Back</button>
			{/if}
			<span class="spacer"></span>
			{#if step === 'welcome'}
				<button type="button" class="btn btn-solid" on:click={() => go('members')}>Let's start</button>
			{:else if step === 'members'}
				<button type="button" class="btn btn-solid" on:click={membersNext} disabled={busy}>Next</button>
			{:else if step === 'device'}
				<button type="button" class="btn btn-solid" on:click={() => go(steps[at + 1])} disabled={!me}>Next</button>
			{:else if step === 'theme'}
				<button type="button" class="btn btn-solid" on:click={() => go(steps[at + 1])}>Next</button>
			{:else if step === 'rooms'}
				<button type="button" class="btn btn-solid" on:click={() => go(steps[at + 1])} disabled={busy}>{rooms.length ? 'Next' : 'Skip'}</button>
			{:else if step === 'chore'}
				<button type="button" class="btn btn-ghost" on:click={() => go('done')} disabled={busy}>Skip</button>
				<button type="button" class="btn btn-solid" on:click={addChore} disabled={busy}>{busy ? 'Adding…' : 'Add chore'}</button>
			{:else if step === 'done'}
				<button type="button" class="btn btn-solid" on:click={() => onDone()}>Go to home</button>
			{/if}
		</footer>
	</div>
</section>

<style>
	.intro {
		width: min(40rem, calc(100% - 2 * var(--space-md)));
		margin: var(--space-lg) auto 0;
	}

	/* The almanac card: 2px rose border, a rose band, flat at rest */
	.card {
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-lg);
		background: var(--paper);
		overflow: hidden;
	}

	.band {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-xs) var(--space-sm);
		min-height: 3rem;
		box-sizing: border-box;
		padding: var(--space-xs) var(--space-md);
		background: var(--primary);
		color: var(--paper);
	}
	.kind {
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.count {
		font-size: var(--text-sm);
		font-style: italic;
		white-space: nowrap;
	}

	/* Progress: a paper track under the band, filled from the left */
	.progress {
		height: 6px;
		background: var(--primary-a25);
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--primary);
		transform-origin: left;
		transform: scaleX(var(--done));
		transition: transform var(--dur-slow) var(--ease-out);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-lg) var(--space-md);
	}
	.step {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		min-width: 0;
	}
	.step-title {
		margin: 0;
		font-size: var(--text-lg);
		line-height: var(--leading-tight);
		color: var(--primary);
		text-wrap: balance;
	}
	.body p { margin: 0; }
	.lead { color: var(--ink); }

	.tour, .summary {
		margin: 0;
		padding-left: 1.2em;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		color: var(--ink);
		line-height: var(--leading-body);
	}
	.tour strong, .summary strong { color: var(--primary); }

	.dot {
		display: inline-block;
		flex-shrink: 0;
		width: 14px;
		height: 14px;
		border-radius: var(--radius-circle);
		border: var(--bw-hair) solid var(--primary);
		vertical-align: -1px;
	}
	.who { white-space: nowrap; }
	.who .dot { margin-right: 5px; }

	/* Members so far: ruled rows, like a register */
	.members {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: var(--bw-hair) solid var(--primary-a25);
	}
	.members li {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-height: 44px;
		border-bottom: var(--bw-hair) solid var(--primary-a25);
	}
	.members .name {
		flex: 1;
		min-width: 0;
		font-weight: var(--weight-bold);
		color: var(--primary);
		overflow-wrap: break-word;
	}
	.remove {
		min-height: 36px;
		padding: 0 var(--space-sm);
		border: var(--bw) solid transparent;
		border-radius: var(--radius-md);
		background: none;
		color: var(--danger);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: var(--swap);
	}
	@media (hover: hover) {
		.remove:hover { border-color: var(--danger); }
	}

	/* Fields: label above, the system's underline */
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: none;
	}
	.label {
		padding: 0;
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		color: var(--primary);
	}
	.inline { display: flex; gap: var(--space-sm); align-items: flex-end; }
	.line {
		flex: 1;
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: var(--control-min-h);
		padding: 4px 0;
		border: none;
		border-bottom: var(--bw) solid var(--primary);
		border-radius: 0;
		background: none;
		color: var(--primary);
		font: inherit;
		transition: var(--swap);
	}
	.line:focus { border-bottom-color: var(--primary-deep); }
	.line[aria-invalid='true'] { border-bottom-color: var(--urgent); }
	.line::placeholder { color: var(--primary); font-style: italic; opacity: 1; }
	.field-error { margin: 0; font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--urgent); }

	/* Colour swatches: real radios, a ring marks the pick */
	.colors { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
	.color {
		position: relative;
		display: inline-grid;
		place-items: center;
	}
	.color input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.color span {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		box-sizing: border-box;
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-circle);
		background: var(--c);
		color: var(--primary);
		font-weight: var(--weight-bold);
		transition: box-shadow var(--dur-fast) var(--ease-out);
	}
	.color input:checked + span,
	.color.custom.on span { box-shadow: 0 0 0 3px var(--paper), 0 0 0 5px var(--primary); }
	.color input:focus-visible + span { outline: var(--bw) solid var(--primary-deep); outline-offset: 7px; }

	/* People on this device: big tap targets */
	.people { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
	.person { position: relative; display: inline-flex; }
	.person input, .pick input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.person > span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		min-height: 48px;
		padding: 0 var(--space-md);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		background: var(--paper);
		color: var(--primary);
		font-weight: var(--weight-bold);
		white-space: nowrap;
		transition: var(--swap);
	}
	.person input:checked + span { background: var(--primary); color: var(--paper); }
	.person input:checked + span .dot { border-color: var(--paper); }
	.person input:focus-visible + span,
	.pick input:focus-visible + .chip { outline: var(--bw) solid var(--primary-deep); outline-offset: 2px; }

	/* Chips: the shared .chip; picks are real checkboxes and radios under it */
	.chips { display: flex; flex-wrap: wrap; gap: var(--space-xs); }
	.chip { font-size: var(--text-sm); white-space: nowrap; }
	.chip:disabled { cursor: default; }
	.pick { position: relative; display: inline-flex; }
	.pick input:checked + .chip { background: var(--primary); color: var(--paper); }
	.pick input:checked + .chip::before { content: '✓ '; white-space: pre; }

	@media (hover: hover) {
		.person:hover input:not(:checked) + span { background: var(--paper-shade); }
	}

	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border-top: var(--bw-hair) solid var(--primary-a25);
	}
	.foot .btn { white-space: nowrap; }
	.spacer { flex: 1; }
	.foot-error {
		flex-basis: 100%;
		margin: 0;
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		color: var(--urgent);
	}

	@media (max-width: 640px) {
		.intro { width: calc(100% - 2 * var(--space-sm)); margin-top: var(--space-sm); }
		.foot { padding-bottom: calc(var(--space-sm) + env(safe-area-inset-bottom)); }
	}

	@media (prefers-reduced-motion: reduce) {
		.fill { transition: none; }
	}
</style>
