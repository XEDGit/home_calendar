<div style="display:flex; flex-direction: column; align-items: center;">
    <div>
        <button on:click={() => {viewMode = [pages.calendar, ...viewMode]}}>Calendar</button>
        <button on:click={() => {viewMode = [pages.chores, ...viewMode]}}>Chores</button>
    </div>
</div>