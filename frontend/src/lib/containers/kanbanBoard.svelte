<script>
    import Card from "$lib/buttons/card.svelte";

    export let chores = {};
    let columns = { Late: -1, Today: 0}
    let predefinedColumns = ["In Progress", "Done"];

</script>

<style>
    .boardContainer {
        width: 100%;
        border: solid 2px #96616B;
        border-radius: 10px;
        padding: 1em;
    }

    .boardContent {
        display: flex;
        flex-direction: row;
        gap: 1em;
    }

    .boardHeader {
        color: #96616B;;
        text-align: center;
    }
    
    .column {
        min-width: 320px;
        max-width: 320px;
        display: flex;
        flex-direction: column;
        gap: 1em;
    }

    .separator {
        width: 2px;
        background-color: #96616B;
        margin: 0;
    }

    h2 {
        margin: 0;
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