<script>
    import Form from "$lib/prompts/form.svelte";
    import { onMount } from "svelte";
    import { getTags } from '$lib/requests.js'

    let tags = [];

    onMount(async () => {
        tags = await getTags();
    });


</script>

<style>
    .form-container {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        flex-direction: row;
        gap: 20px;
        color: #96616B;
    }
</style>

<div class="form-container">
    <Form
        title="Add Todo"
        inputs={[
            { name: 'Todo*', id: 'title', type: 'text', placeholder: 'name' },
            { name: 'Description', id: 'description', type: 'textarea', placeholder: 'Description' },
            { name: 'Tag', id: 'tag', type: 'select', options: tags.map((tag) => {return {name: tag, value: tag}}), hidden: tags.length == 0},
            { name: 'Deadline', id: 'deadline', type: 'date', value: '' },
            { name: 'Priority', id: 'priority', type: 'select', options: [{name:'', value: '0'}, {name:'Low', value: '1'}, {name:'Medium', value: '2'}, {name:'High', value: 3}] },
            { name: 'Shared', id: 'shared', type: 'checkbox' },
        ]}
        endpoint="addTodo"
        hook={() => {window.history.back()}}
        width="50%"
    />
</div>
