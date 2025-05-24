<script>
    import Tag from "./tag.svelte";
    export let
        func = (v) => {console.error('Card with no functionality')},
        updateDone = () => {console.error('Checkbox with no functionality')},
        title = '',
        shortTitle = '',
        subtitle = '',
        content = '',
        priority = 0,
        shared = false,
        done = false,
        inverted = false,
        tag = 'tag',
        deadline = new Date();

    function formatDate(date) {
        if (!date)
            return '';
        date = new Date(date);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }
</script>

<style>
    .card-container {
        margin: 0;
        max-width: 48%;
        min-width: 300px;
        display: flex;
        flex-direction: column;
        gap: 5%;
    }

    @media (max-width: 670px) {
        .card-container {
            max-width: 100%;
            min-width: 100%;
        }
    }

    .card {
        border-radius: 10px;
        border: solid 2px #96616B;
        background-color: #FFEAD0;
        color: #96616B;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        padding: 10px;
        cursor: pointer;
    }

    .card:hover {
        transform: scale(1.02);
    }

    .text-display {
        text-align: left;
        font-size: 1.2em;
        background-color: #96616B;
        text-wrap: wrap;
        overflow-wrap: break-word;
        word-break: break-word;
        color: #FFEAD0;
        border-radius: 5px;
        padding: 1em;
        margin-bottom: 10px;
        margin-top: -10px;
    }

    input[type="checkbox"] {
        width: 2em;
        height: 2em;
        background-color: #FFEAD0;
        border: 3px solid #96616B;
        border-radius: 5px;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    input[type="checkbox"]:hover, input[type="checkbox"]:checked {
        background-color: #96616B;
    }

    input[type="checkbox"]:checked::before {
        content: '✓';
        color: #FFEAD0;
        font-size: 1.4em;
        font-weight: bold;
    }

    .horizontal-organizer {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
    }

    .footer-right {
        display: flex;
        gap: 1em;
        flex-wrap: wrap;
        align-items: center;
    }

    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
    }

    .priority {
        width: 2.2em;
        height: 2.2em;
        border-radius: 5px;
        background: gray;
    }

    h2 {
        margin-top: 0;
        color: #96616B;
        font-weight: bold;
        text-align: left;
        word-break: break-word;
    }

    .inverted {
        background-color: #FFEAD0;
        color: #96616B;
    }
</style>

<div class="card-container">
    <button class="card" on:click={func}>
        <div class="horizontal-organizer" style="align-items: start;">
            <div style="max-width: 90%;">
                <h2>{shortTitle}</h2>
            </div>
            <form>
                <input type="checkbox" on:click={e => {e.stopPropagation(); updateDone();}} bind:checked={done} on:change={() => {"TODO: update the backend"}} />
            </form>
        </div>
        {#if content}
        <div class="text-display">
            {content.substring(0, 50) + (content.length > 50 ? '...' : '')}
        </div>
        {/if}
        <div class="horizontal-organizer">
            <div class="tags">
                {#if shared}
                    <i style='opacity: 0.8;' class="material-icons">group</i>
                {/if}
                {#if tag}
                    <Tag>{tag}</Tag>
                {/if}
            </div>
            <div class="footer-right">
                <h4>{formatDate(deadline)}</h4>
                <div class='priority' style="background-color: {priority == 3? 'red' : priority == 2? 'orange' : priority == 1? 'green' : 'gray'}"></div>
            </div>
        </div>
    </button>
</div>