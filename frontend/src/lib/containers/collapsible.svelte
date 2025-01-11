<script>
    import { fly } from "svelte/transition";

    export let title = 'Show More' 
    let isOpen = false;
</script>

<style>
    .collapsible-container {
        border-radius: 5px;
        width: 100%;
    }
    
    .collapsible-button {
        border: solid #96616B 3px;
        color: #FFEAD0;
        border-radius: 5px;
        padding: 10px;
        text-align: left;
        font-size: 16px;
        cursor: pointer;
        text-decoration: underline;
        width: 100%;
    }

    .collapsible-button:hover {
        background-color: #FFEAD0;
        color: #96616B;
    }
</style>

<div class="collapsible-container">
    <button class="collapsible-button retro-red" on:click={() => (isOpen = !isOpen)}>
        {isOpen ? 'Hide' : title}
    </button>
    {#if isOpen}
        <div class="collapsible-content" transition:fly={{ y: -10, duration: 300 }}>
            <slot>
            </slot>
        </div>
    {/if}
</div>
