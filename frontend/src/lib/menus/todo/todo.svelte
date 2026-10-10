<script>
    import { onMount } from 'svelte';
    import { getTodos, getTags, updateTodo } from '$lib/requests.js'
    import Card from '$lib/buttons/card.svelte';
    import TodoSheet from '$lib/sheet/TodoSheet.svelte';
    import { reveal, vanish, move } from '$lib/motion';

    export let todos = [];
    let tags = [];
    let activeTags = [];
    let selectedTodo = null;

    // Kept alive in the background between visits: coming back to this tab
    // refreshes it in place
    // Called once the first data is in, so the page knows this tab can
    // slide in whole
    export let onReady = () => {};
    export let active = true;
    let wasActive = active;
    $: onActiveChange(active);
    function onActiveChange(isActive) {
        if (isActive && !wasActive) load();
        wasActive = isActive;
    }

    const handleTagClick = (idx) => {
        activeTags[idx] = !activeTags[idx];
    }

    const filterTodos = (todos) => {
        // Check if any tag is active. If not, return all todos.
        const anyTagActive = activeTags.some(tag => tag);
        if (!anyTagActive) {
            return todos;
        }

        // Get the status of special tags
        const personalActive = activeTags[0];
        const sharedActive = activeTags[1];

        // Get the list of active regular tags (tags excluding 'personal' and 'shared')
        const activeRegularTags = tags.slice(2).filter((_, i) => activeTags[i + 2]);

        return todos.filter(todo => {
            let matchesRegularTag = true;
            // Check if the todo matches any active regular tag
            if (activeRegularTags.some(tag => tag))
                matchesRegularTag = activeRegularTags.includes(todo.tag);

            // Check if the todo matches the 'personal' criteria (if active)
            const matchesPersonal = personalActive && !todo.shared;

            // Check if the todo matches the 'shared' criteria (if active)
            const matchesShared = sharedActive && todo.shared;

            // The todo should be included if it matches any of the active criteria
            return matchesRegularTag && (matchesPersonal || matchesShared);
        });
    };

    function handleTodoClick(todo) {
        selectedTodo = todo;
    }

    // The sheet: a todo opened from the board, or a new one (the + button).
    // What it saves or deletes updates the list in place.
    let adding = false;
    export function openAdd() {
        selectedTodo = null;
        adding = true;
    }

    function closeSheet() {
        selectedTodo = null;
        adding = false;
    }

    function handleTodoSaved(saved) {
        const i = todos.findIndex(t => t._id === saved._id);
        if (i === -1) load();
        else todos[i] = { ...todos[i], ...saved };
    }

    function handleTodoDeleted(id) {
        todos = todos.filter(t => t._id !== id);
    }

    async function load() {
        // In parallel; assigned together so the filters render complete
        const [todoList, tagList] = await Promise.all([getTodos(), getTags()]);
        const nextTags = ['personal', 'shared', ...tagList];
        // A refresh keeps the tag filters, unless the tags themselves changed
        if (nextTags.join() !== tags.join()) activeTags = nextTags.map(() => false);
        todos = todoList;
        tags = nextTags;
        onReady();
    }

    onMount(load);

</script>


<style>
    .todo-container {
        position: relative;
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: flex-start;
        flex-direction: row;
        gap: 1em;
    }

    /* Each card sits in a slot so the list can animate: filtered-out cards
       fade, the rest glide into the gap */
    .card-slot {
        flex: 0 1 48%;
        min-width: min(300px, 100%);
    }

    @media (max-width: 670px) {
        .todo-container {
            flex-direction: column;
            align-items: center;
        }

        .card-slot {
            flex-basis: auto;
            width: 100%;
        }
    }

    .filter {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-start;
        flex-direction: row;
        gap: 1em;
        color: var(--primary);
        margin-bottom: var(--space-lg);
    }

    @media (max-width: 670px) {
        .filter {
            gap: 6px 8px;
        }
    }

    button {
        background-color: var(--paper);
        color: var(--primary);
        border: var(--bw) solid var(--primary);
        border-radius: var(--radius-pill);
        padding: var(--chip-pad-y) var(--chip-pad-x);
        cursor: pointer;
        font-weight: var(--weight-bold);
        transition: var(--swap);
    }

    @media (hover: hover) {
        button:hover {
            background-color: var(--primary);
            color: var(--paper);
        }
    }

    button::before {
        content: '# ';
    }

    .active {
        background-color: var(--primary);
        color: var(--paper);
    }

    @media (hover: hover) {
        .active:hover {
            background-color: var(--primary);
            color: var(--paper);
        }
    }
</style>

<div class='filter'>
    <span style='font-weight: var(--weight-bold)'>Tags:</span>
    {#each tags as tag, idx}
        <button class='tag {activeTags[idx]? 'active' : ''}' on:click={() => handleTagClick(idx)}>
            {tag}
        </button>
    {/each}
</div>
<div class="todo-container">
    {#each filterTodos(todos) as todo (todo._id)}
        <div class="card-slot" animate:move in:reveal out:vanish>
            <Card
                title={todo.title}
                shortTitle={todo.shortTitle}
                subtitle={todo.subtitle || ''}
                content={todo.description || ''}
                tag={todo.tag || ''}
                deadline={todo.deadline || ''}
                priority={todo.priority || ''}
                shared={todo.shared || ''}
                done={todo.done || ''}
                func={() => {handleTodoClick(todo)}}
                updateDone={() => {todo.done = !todo.done; updateTodo({ _id: todo._id, done: todo.done });
                }}
            />
        </div>
    {/each}
    <div></div>
</div>

{#if selectedTodo}
    <TodoSheet todo={selectedTodo} onSaved={handleTodoSaved} onDeleted={handleTodoDeleted} onClose={closeSheet} />
{:else if adding}
    <TodoSheet onSaved={handleTodoSaved} onClose={closeSheet} />
{/if}