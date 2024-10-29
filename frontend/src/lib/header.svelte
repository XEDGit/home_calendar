<div style="display:flex; flex-direction: column; align-items: center;">
    <h1>Event Calendar</h1>
    <div>
        <button on:click={() => {viewMode = [pages.calendar, ...viewMode]}}>Calendar</button>
        <button on:click={() => {viewMode = [pages.chores, ...viewMode]}}>Chores</button>
    </div>
</div>