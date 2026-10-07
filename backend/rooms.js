import { Router } from 'express';
import db, { ObjectId } from './db.js';
import { getID } from './helpers.js';

const router = Router();

router.get('/rooms', async (req, res) => {
	await db.findRespond('rooms', req.cookies.session, res)
});

router.post('/rooms', async (req, res) => {
	const newRoom = req.body;
	await db.insertRespond(newRoom, 'rooms', req.cookies.session, res)
});

router.post('/rooms/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	await db.deleteRespond('rooms', req.cookies.session, res, {_id: id})
});

export default router;
