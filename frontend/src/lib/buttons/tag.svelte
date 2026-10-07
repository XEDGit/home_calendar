<script>
    export let
        func = (v) => {console.error('Tag with no functionality')},
        title = 'tag title',
        active = false,
        inverted = false;
</script>

<style>
    .tag-container {
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .tag {
        border-radius: var(--radius-pill);
        border: var(--bw) solid var(--primary);
        background-color: var(--paper);
        color: var(--primary);
        display: flex;
        justify-content: center;
        align-items: center;
        padding: var(--chip-pad-y) var(--chip-pad-x);
        font-weight: var(--weight-bold);
        transition: var(--swap);
    }

    @media (hover: hover) {
        .tag:hover {
            color: var(--paper);
            background-color: var(--primary);
        }
    }
</style>

<div class='tag-container'>
    <button class="tag" on:click={func}>
        # <slot />
    </button>
</div>