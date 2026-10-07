import { Router } from 'express';
import db, { ObjectId } from './db.js';

const router = Router();

router.get('/todos', async (req, res) => {
	if (!req.cookies.user || !req.cookies.session) {
		return res.status(400).send({ error: 'Missing authorization' });
	}
	await db.findRespond(
		'todos',
		req.cookies.session,
		res,
		{
			$or: [
				{ user: req.cookies.user },
				{ shared: true }
			]
		}
	);
});

router.post('/todos', async (req, res) => {
	if (!req.cookies.user || !req.cookies.session) {
		return res.status(400).send({ error: 'Missing authorization' });
	}
	const newTodo = req.body;
	newTodo['user'] = req.cookies.user
	newTodo['done'] = false
	newTodo['date'] = new Date()
	if (newTodo['deadline'])
		newTodo['deadline'] = new Date(newTodo['deadline']);
	newTodo['shortTitle'] = newTodo['title'].substring(0, 20) + (newTodo['title'].length > 20? '...' : '');
	await db.insertRespond(newTodo, 'todos', req.cookies.session, res)
});

router.post('/updateTodo', async (req, res) => {
	const updatedTodo = req.body;
	if (!req.cookies.user || !req.cookies.session) {
		return res.status(400).send({ error: 'Missing authorization' });
	}
	if (!updatedTodo._id) {
		return res.status(400).send({ success: false, message: 'Missing todo ID' });
	}
	if (updatedTodo['title'])
		updatedTodo.shortTitle = updatedTodo.title.substring(0, 20) + (updatedTodo.title.length > 20? '...' : '');

	try {
		const id = new ObjectId(updatedTodo._id);
		delete updatedTodo._id;
		delete updatedTodo.user;

		const existingTodo = await db.find('todos', req.cookies.session, { _id: id });
		if (!existingTodo || existingTodo.length === 0 || (existingTodo[0].user != req.cookies.user && !existingTodo[0].shared)) {
			return res.status(404).send({ success: false, message: 'Todo not found' });
		}

		const result = await db.update('todos', req.cookies.session, { _id: id }, { $set: updatedTodo });
		if (result) {
			const updatedDoc = await db.find('todos', req.cookies.session, { _id: id });
			if (updatedDoc && updatedDoc.length > 0) {
				return res.status(200).send({ success: true });
			}
		}
		return res.status(500).send({ success: false, message: 'Failed to update todo' });
	} catch (error) {
		console.error('Error updating todo:', error);
		return res.status(500).send({ success: false, message: 'Internal server error' });
	}
});

router.post('/deleteTodo', async (req, res) => {
	if (!req.cookies.user || !req.cookies.session) {
		return res.status(400).send({ error: 'Missing authorization' });
	}
	if (!req.body.id) {
		return res.status(400).send({ success: false, message: 'Missing todo ID' });
	}

	try {
		const id = new ObjectId(req.body.id);

		const existingTodo = await db.find('todos', req.cookies.session, { _id: id, user: req.cookies.user });
		if (!existingTodo || existingTodo.length === 0 || existingTodo[0].user != req.cookies.user) {
			return res.status(404).send({ success: false, message: 'Todo not found' });
		}

		const result = await db.delete('todos', req.cookies.session, { _id: id, user: req.cookies.user});
		if (result) {
			return res.status(200).send({ success: true });
		} else {
			return res.status(500).send({ success: false, message: 'Failed to delete todo' });
		}
	} catch (error) {
		console.error('Error deleting todo:', error);
		return res.status(500).send({ success: false, message: 'Internal server error' });
	}
});

export default router;
