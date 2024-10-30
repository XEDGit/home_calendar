<script>
    export let fcal;
    export let fcho;
</script>

<div style="display:flex; flex-direction: column; justify-content: center; align-items: center;">
    <h1>Event Calendar</h1>
    <div class="navBar">
        <button class="navButton" on:click={fcal}>Calendar</button>
        <button class="navButton" on:click={fcho}>Chores</button>
    </div>
</div>