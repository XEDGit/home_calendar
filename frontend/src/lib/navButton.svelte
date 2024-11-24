<script>
    export let fcal, fcho, fsett;
</script>

<div style="display:flex; flex-direction: column; justify-content: center; align-items: center;">
    <h1>Event Calendar</h1>
    <div class="navBar">
        <button class="navButton" on:click={fcal}>Calendar</button>
        <button class="navButton" on:click={fcho}>Chores</button>
        <button class="navButton" on:click={fsett}>Settings</button>
    </div>
</div>