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
        border-radius: 10px;
        border: solid 2px #96616B;
        background-color: #FFEAD0;
        color: #96616B;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 5px 10px;
        font-weight: bold;
    }

    .tag:hover {
        color: #FFEAD0;
        background-color: #96616B;
    }
</style>

<div class='tag-container'>
    <button class="tag" on:click={func}>
        # <slot />
    </button>
</div>