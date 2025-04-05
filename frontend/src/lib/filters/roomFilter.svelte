<script>
    import Button from "$lib/buttons/button.svelte";
    
    export let rooms = [];
    export let selectedRooms = [];
    export let title = "Filter:";
    export let showAllButton = true;
    
    function clearFilter() {
        selectedRooms = [];
        updateFilter();
    }
    
    function handleFilter(roomName) {
        if (selectedRooms.includes(roomName)) {
            selectedRooms = selectedRooms.filter(item => item !== roomName);
        } else {
            selectedRooms = [...selectedRooms, roomName];
        }
        updateFilter();
    }
    
    export let onFilterChange = () => {};
    
    function updateFilter() {
        onFilterChange(selectedRooms);
    }
</script>

<style>
    .filter-container {
        display: flex;
        flex-direction: column;
        gap: 5px;
        width: 100%;
        margin: 1em 0;
    }
    
    .title {
        color: #96616B;
        background-color: #FFEAD0;
        margin: 0;
        margin-top: 10px;
        font-weight: bold;
    }
    
    .buttons-container {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
    }
</style>

<div class="filter-container">
    {#if title}
        <p class="title">{title}</p>
    {/if}
    <div class="buttons-container">
        {#if showAllButton}
            <Button title='All' func={clearFilter} inverted={true} active={selectedRooms.length === 0} />
        {/if}
        {#each rooms as room}
            <Button 
                title={room.name} 
                func={() => handleFilter(room.name)} 
                inverted={true} 
                active={selectedRooms.includes(room.name)} 
            />
        {/each}
    </div>
</div>