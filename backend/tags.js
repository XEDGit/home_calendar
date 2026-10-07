import { Router } from 'express';
import db from './db.js';

const router = Router();

router.get('/tags', async (req, res) => {
	if (!req.cookies.user || !req.cookies.session) {
		return res.status(400).send({ error: 'Missing authorization' });
	}
	try {
		const tagsDoc = await db.find('tags', req.cookies.session, { user: req.cookies.user });
		if (tagsDoc && tagsDoc.length > 0) {
			res.status(200).send(tagsDoc[0].tags || []);
		} else {
			res.status(200).send([]);
		}
	} catch (error) {
		console.error('Error fetching tags:', error);
		res.status(500).send({ error: 'Internal server error' });
	}
});

router.post('/tags', async (req, res) => {
	if (!req.cookies.user || !req.cookies.session) {
		return res.status(400).send({ error: 'Missing authorization' });
	}
	const { tag } = req.body;
	if (!tag || typeof tag !== 'string' || tag.trim() === '') {
		return res.status(400).send({ error: 'Invalid or missing tag' });
	}

	const session = req.cookies.session;
	const user = req.cookies.user;
	const trimmedTag = tag.trim();

	try {
		const updateResult = await db.update('tags', session,
			{ user: user },
			{ $addToSet: { tags: trimmedTag } }
		);

		if (updateResult) {
			res.status(200).send({ success: true, message: 'Tag added or already exists' });
		} else {
			await db.insertRespond({ user: user, tags: [trimmedTag] }, 'tags', session, res);
		}
	} catch (error) {
		console.error('Error adding tag:', error);
		res.status(500).send({ error: 'Internal server error' });
	}
});

router.post('/deleteTag', async (req, res) => {
	if (!req.cookies.user || !req.cookies.session) {
		return res.status(400).send({ error: 'Missing authorization' });
	}
	const { tag } = req.body;
	if (!tag || typeof tag !== 'string' || tag.trim() === '') {
		return res.status(400).send({ error: 'Invalid or missing tag' });
	}

	const session = req.cookies.session;
	const user = req.cookies.user;
	const trimmedTag = tag.trim();

	try {
		const result = await db.update('tags', session,
			{ user: user },
			{ $pull: { tags: trimmedTag } }
		);

		if (result) {
			res.status(200).send({ success: true, message: 'Tag deleted successfully' });
		} else {
			res.status(404).send({ success: false, message: 'Tag or user tag document not found' });
		}
	} catch (error) {
		console.error('Error deleting tag:', error);
		res.status(500).send({ error: 'Internal server error' });
	}
});

export default router;
