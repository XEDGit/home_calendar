<script>
	// Renders an assistant reply's markdown (see ./markdown.js) as elements
	// with text children. There is deliberately no {@html} here.
	import { parse } from './markdown.js';
	import { linkify } from '#lib/helpers/linkify.js';

	export let text = '';
	// Turn http(s) URLs in the text into links (automation results)
	export let links = false;
	// Level of the heading this text sits under: # renders one below it
	export let below = 2;

	$: blocks = parse(text);
</script>

{#snippet inline(nodes)}{#each nodes as n}{#if n.t === 'strong'}<strong>{@render inline(n.children)}</strong>{:else if n.t === 'em'}<em>{@render inline(n.children)}</em>{:else if links}{#each linkify(n.v) as part}{#if part.url}<a href={part.url} target="_blank" rel="noopener noreferrer nofollow">{part.text}</a>{:else}{part.text}{/if}{/each}{:else}{n.v}{/if}{/each}{/snippet}

<div class="md">
	{#each blocks as b}
		{#if b.type === 'heading'}
			<svelte:element this={`h${Math.min(6, below + b.depth)}`} class="h" class:h1={b.depth === 1}>{@render inline(b.inline)}</svelte:element>
		{:else if b.type === 'rule'}
			<hr />
		{:else if b.type === 'table'}
			<!-- A wide table scrolls sideways inside the reply, never the page -->
			<div class="table">
				<table>
					<thead>
						<tr>{#each b.head as cell, c}<th scope="col" style:text-align={b.align[c]}>{@render inline(cell)}</th>{/each}</tr>
					</thead>
					<tbody>
						{#each b.rows as row}
							<tr>{#each row as cell, c}<td style:text-align={b.align[c]}>{@render inline(cell)}</td>{/each}</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if b.type === 'list'}
			<ul>
				{#each b.items as item}
					<li style:margin-left="{item.depth * 1.25}em">{@render inline(item.inline)}</li>
				{/each}
			</ul>
		{:else}
			<p>{#each b.lines as line, i}{#if i}<br />{/if}{@render inline(line)}{/each}</p>
		{/if}
	{/each}
</div>

<style>
	/* Printed-entry rhythm: rose headings, teal-ink paragraphs and items,
	 * rose bullets. Sizes stay on the type scale. */
	.md { white-space: normal; display: flex; flex-direction: column; gap: var(--space-sm); }
	.md > * { margin: 0; }
	.h {
		font-size: var(--text-base); font-weight: var(--weight-bold); line-height: var(--leading-tight);
		color: var(--primary); text-wrap: balance;
	}
	.h.h1 { font-size: var(--text-md); }
	/* A heading belongs to what follows it */
	.md > .h:not(:first-child) { margin-top: var(--space-xs); }
	ul { padding-left: 1.25em; display: flex; flex-direction: column; gap: 2px; }
	li::marker { color: var(--primary); }
	strong { font-weight: var(--weight-bold); }
	/* Tables read like a printed ledger: rose header over a firmer rule,
	 * hairlines between rows, no outer box, figures in even columns */
	.table { max-width: 100%; overflow-x: auto; scrollbar-width: thin; scrollbar-color: var(--primary-a45) transparent; }
	table { border-collapse: collapse; font-size: var(--text-sm); line-height: var(--leading-snug); font-variant-numeric: tabular-nums; }
	th, td { padding: var(--space-xs) var(--space-sm); vertical-align: top; overflow-wrap: normal; text-align: left; }
	th:first-child, td:first-child { padding-left: 0; }
	th:last-child, td:last-child { padding-right: 0; }
	th { color: var(--primary); font-weight: var(--weight-bold); border-bottom: var(--bw) solid var(--primary-a45); }
	td { border-bottom: var(--bw-hair) solid var(--primary-a25); }
	tbody tr:last-child td { border-bottom: none; }
	/* Whole words in cells, links too: a long one scrolls the table instead */
	.table a { overflow-wrap: normal; }
	/* A quiet rule at border weight: a hairline read too faint in a reply */
	hr { width: 100%; height: 0; border: none; border-top: var(--bw) solid var(--primary-a25); }
	a { color: inherit; overflow-wrap: anywhere; }
</style>
