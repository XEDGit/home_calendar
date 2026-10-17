<script>
    // Opens and closes in place: content below glides instead of jumping
    import { expand } from "#lib/motion.js";

    export let title = 'Show More'
    let isOpen = false;
</script>

<style>
    .collapsible-container {
        border-radius: var(--radius-md);
        width: 100%;
    }

    .collapsible-button {
        border: var(--bw) solid var(--primary);
        color: var(--paper);
        border-radius: var(--radius-md);
        padding: var(--space-sm);
        text-align: left;
        font-size: var(--text-base);
        cursor: pointer;
        text-decoration: underline;
        width: 100%;
        transition: var(--swap);
    }

    @media (hover: hover) {
        .collapsible-button:hover {
            background-color: var(--paper);
            color: var(--primary);
        }
    }
</style>

<div class="collapsible-container">
    <button class="collapsible-button retro-red" aria-expanded={isOpen} on:click={() => (isOpen = !isOpen)}>
        {isOpen ? 'Hide' : title}
    </button>
    {#if isOpen}
        <div class="collapsible-content" transition:expand>
            <slot>
            </slot>
        </div>
    {/if}
</div>
