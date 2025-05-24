<script>
    import { onMount } from 'svelte';
    import { getTodos, getTags, updateTodo, deleteTodo } from '$lib/requests.js'
    import Card from '$lib/buttons/card.svelte';
    import UpdateTodo from './updateTodo.svelte';

    export let todos = [];
    let tags = [];
    let activeTags = [];
    let selectedTodo = null;

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

    function resetTodoSelection() {
        selectedTodo = null;
    }

    async function handleTodoUpdate(updatedTodo) {
        try {
            await updateTodo(updatedTodo);
            const index = todos.findIndex(t => t._id === updatedTodo.id);
            if (index !== -1) {
                todos[index] = { ...todos[index], ...updatedTodo };
            }
            todos = await getTodos();
            resetTodoSelection();
        } catch (error) {
            console.error('Error updating todo:', error);
        }
    }

    async function handleTodoDelete(todoId) {
        try {
            await deleteTodo({ id: todoId });
            todos = todos.filter(t => t._id !== todoId);
            resetTodoSelection();
        } catch (error) {
            console.error('Error deleting todo:', error);
        }
    }

    onMount(async () => {
        todos = await getTodos();
        tags = await getTags();
        tags.unshift('shared');
        tags.unshift('personal');
        activeTags = tags.map(() => false);
    });

</script>


<style>
    .todo-container {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: flex-start;
        flex-direction: row;
        gap: 1em;
    }

    @media (max-width: 670px) {
        .todo-container {
            flex-direction: column;
            align-items: center;
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
        color: #96616B;
        margin-bottom: 20px;
    }

    button {
        background-color: #FFEAD0;
        color: #96616B;
        border: solid 2px #96616B;
        border-radius: 5px;
        padding: 5px 10px;
        cursor: pointer;
        font-weight: bold;
    }

    button:hover {
        background-color: #FFEAD0;
        color: #96616B;
    }

    button::before {
        content: '# ';
    }

    .active, .active:hover {
        background-color: #96616B;
        color: #FFEAD0;
    }
</style>

<div class='filter'>
    <span style='font-weight: bold'>Tags:</span>
    {#each tags as tag, idx}
        <button class='tag {activeTags[idx]? 'active' : ''}' on:click={() => handleTagClick(idx)}>
            {tag}
        </button>
    {/each}
</div>
<div class="todo-container">
    {#each filterTodos(todos) as todo}
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
            {/each}
    <div></div>
</div>

{#if selectedTodo}
    <UpdateTodo 
        todo={selectedTodo} 
        onSubmit={handleTodoUpdate} 
        reset={resetTodoSelection} 
        delFunc={handleTodoDelete} 
    />
{/if}