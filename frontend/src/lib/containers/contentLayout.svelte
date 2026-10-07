<script>
    import { reveal } from '$lib/motion';

    // Only the page shell is the <main> landmark; nested layouts stay divs.
    export let as = 'div';
    // The page shell's container and title morph during page transitions.
    export let pageView = false;
    export let title = '';
    export let loading = false;
    export let empty = false;
    export let emptyMessage = '';
    export let emptyAction = '';
    export let filterBar = false;
</script>

<style>
    .content-container {
        width: 95%;
        margin: 0 auto;
    }
    
    .tooltip {
        text-transform: none;
        color: var(--primary);
        font-style: italic;
        white-space: wrap;
        margin-bottom: 10px;
    }

    /* Quick loads never show the loading line; slow ones fade it in */
    .loading-line {
        animation: loading-appear var(--dur-base) var(--ease-out) 300ms both;
    }

    @keyframes loading-appear {
        from {
            opacity: 0;
        }
    }
    
    .filter-bar {
        width: 100%;
        padding: var(--space-sm) 0;
        display: flex;
        gap: var(--space-xs);
        flex-wrap: wrap;
        color: var(--primary);
        align-items: center;
    }
</style>

<svelte:element this={as} class="content-container" class:page-view={pageView}>
    {#if title}
        <h1 class="title" class:page-title={pageView}>{title}</h1>
    {/if}

    {#if loading}
        <p class="tooltip loading-line" role="status">Loading…</p>
    {:else if empty}
        <div in:reveal>
            <p class="tooltip">{emptyMessage}</p>
            {#if emptyAction}
                <p class="tooltip">{@html emptyAction}</p>
            {/if}
        </div>
    {:else}
        <!-- Content settles in when it replaces the loading line -->
        <div in:reveal>
            {#if filterBar}
                <div class="filter-bar">
                    <slot name="filter-bar" />
                </div>
            {/if}
            <slot />
        </div>
    {/if}
</svelte:element>
