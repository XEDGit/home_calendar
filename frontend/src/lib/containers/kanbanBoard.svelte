<script>
    import Card from "$lib/buttons/card.svelte";

    export let chores = {};
    let columns = { Late: -1, Today: 0}
    let predefinedColumns = ["In Progress", "Done"];

</script>

<style>
    .boardContainer {
        width: 100%;
        box-sizing: border-box;
        border: var(--bw) solid var(--primary);
        border-radius: var(--radius-lg);
        padding: 1em;
    }

    /* Columns scroll sideways as snap lanes; the page itself never scrolls horizontally */
    .boardContent {
        display: flex;
        flex-direction: row;
        gap: 1em;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        overscroll-behavior-x: contain;
    }

    .boardHeader {
        color: var(--primary);
        text-align: center;
    }
    
    .column {
        flex: 0 0 min(320px, 85%);
        scroll-snap-align: start;
        display: flex;
        flex-direction: column;
        gap: 1em;
    }

    .separator {
        width: var(--bw);
        background-color: var(--primary);
        margin: 0;
    }

    h2 {
        margin: 0;
        font-size: var(--text-md);
        text-align: center;
    }
</style>

<div class="boardContainer">
    <div class="boardHeader">
        Tasks Board
    </div>
    <div class="boardContent">
        {#each Object.entries(columns) as column}
            <div class="column">
                <h2>{column[0]}</h2>
                {#each Object.keys(chores).filter((day) => {return column[1] < 0? day < 0 : day == column[1]}) as negativeDays}
                    {#each chores[negativeDays] as chore}
                        <Card
                            title={chore.name}
                            shortTitle={chore.name}
                            content={chore.rooms.map(r => r.name).join(', ')}
                            priority={3}
                            done={chore.done}
                        />
                    {/each}
                {/each}
            </div>
            <div class='separator'></div>
        {/each}
        {#each predefinedColumns as column}
            <div class="column">
                <h2>{column}</h2>
                {#each Object.keys(chores).filter((day) => day == column) as choreDay}
                    
                {/each}
            </div>
            {#if predefinedColumns.indexOf(column) < predefinedColumns.length - 1}
                <div class='separator'></div>
            {/if}
        {/each}
    </div>
</div>