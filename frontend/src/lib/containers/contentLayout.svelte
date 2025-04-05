<script>
    import { onMount } from 'svelte';
    
    export let title = '';
    export let loading = false;
    export let empty = false;
    export let emptyMessage = '';
    export let emptyAction = '';
    export let filterBar = false;
</script>

<style>
    .content-container {
        width: 90%;
        margin: 0 auto;
    }
    
    .tooltip {
        text-transform: none;
        color: gray;
        font-style: italic;
        white-space: wrap;
        margin-bottom: 10px;
    }
    
    .filter-bar {
        width: 100%;
        padding: 10px 0;
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
        color: #96616B;
        align-items: center;
    }
</style>

<div class="content-container">
    {#if title}
        <h1 class="title">{title}</h1>
    {/if}
    
    {#if loading}
        <p class="tooltip">Loading...</p>
    {:else if empty}
        <p class="tooltip">{emptyMessage}</p>
        {#if emptyAction}
            <p class="tooltip">{@html emptyAction}</p>
        {/if}
    {:else}
        {#if filterBar}
            <div class="filter-bar">
                <slot name="filter-bar" />
            </div>
        {/if}
        <slot />
    {/if}
</div>