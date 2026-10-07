<script>
    import Tag from "./tag.svelte";
    import GroupIcon from "$lib/icons/GroupIcon.svelte";

    const PRIORITY_NAMES = ['none', 'low', 'medium', 'high'];
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
        position: relative;
        margin: 0;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 5%;
    }


    .card {
        border-radius: var(--radius-lg);
        border: var(--bw) solid var(--primary);
        background-color: var(--paper);
        color: var(--primary);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        padding: var(--space-sm);
        padding-right: calc(44px + var(--space-md));
        font: inherit;
        text-align: left;
        cursor: pointer;
        transition: transform var(--dur-fast) var(--ease-out);
    }

    @media (hover: hover) {
        .card:hover {
            transform: scale(1.02);
        }
    }

    .text-display {
        text-align: left;
        font-size: var(--text-base);
        background-color: var(--primary);
        text-wrap: wrap;
        overflow-wrap: break-word;
        word-break: break-word;
        color: var(--paper);
        border-radius: var(--radius-sm);
        padding: 1em;
        margin-bottom: var(--space-sm);
        margin-top: -10px;
    }

    /* Sibling of the card button (not nested inside it) so it stays its own control */
    .done-toggle {
        position: absolute;
        top: var(--space-sm);
        right: var(--space-sm);
    }

    input[type="checkbox"] {
        width: 44px;
        height: 44px;
        background-color: var(--paper);
        border: var(--bw) solid var(--primary);
        border-radius: var(--radius-sm);
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    input[type="checkbox"]:checked {
        background-color: var(--primary);
    }

    @media (hover: hover) {
        input[type="checkbox"]:hover {
            background-color: var(--primary);
        }
    }

    input[type="checkbox"]:checked::before {
        content: '✓';
        color: var(--paper);
        font-size: var(--text-lg);
        font-weight: var(--weight-bold);
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
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: var(--text-sm);
        font-weight: var(--weight-bold);
        text-transform: capitalize;
    }

    .priority-dot {
        width: 1.4em;
        height: 1.4em;
        border-radius: var(--radius-sm);
        background: var(--idle);
    }

    h2 {
        margin-top: 0;
        font-size: var(--text-md);
        color: var(--primary);
        font-weight: var(--weight-bold);
        text-align: left;
        word-break: break-word;
    }

    .inverted {
        background-color: var(--paper);
        color: var(--primary);
    }
</style>

<div class="card-container">
    <button class="card" on:click={func}>
        <div class="horizontal-organizer" style="align-items: start;">
            <div style="max-width: 90%;">
                <h2>{shortTitle}</h2>
            </div>
        </div>
        {#if content}
        <div class="text-display">
            {content.substring(0, 50) + (content.length > 50 ? '...' : '')}
        </div>
        {/if}
        <div class="horizontal-organizer">
            <div class="tags">
                {#if shared}
                    <GroupIcon label="Shared" />
                {/if}
                {#if tag}
                    <Tag>{tag}</Tag>
                {/if}
            </div>
            <div class="footer-right">
                <h4>{formatDate(deadline)}</h4>
                <div class="priority">
                    <span class="priority-dot" style="background-color: {priority == 3? 'var(--urgent)' : priority == 2? 'var(--warn)' : priority == 1? 'var(--ok)' : 'var(--idle)'}"></span>
                    {#if priority > 0}{PRIORITY_NAMES[priority]}{/if}
                </div>
            </div>
        </div>
    </button>
    <input
        class="done-toggle"
        type="checkbox"
        aria-label="Mark {shortTitle || title} done"
        bind:checked={done}
        on:change={() => updateDone()}
    />
</div>