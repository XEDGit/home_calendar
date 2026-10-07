import { Router } from 'express';
import db from './db.js';
import { getID, getCookie, toObjectId } from './helpers.js';

const router = Router();

router.get('/users', async (req, res) => {
	await db.findRespond('users', req.cookies.session, res)
})

router.post('/users', async (req, res) => {
	const newUser = req.body
	await db.insertRespond(newUser, 'users', req.cookies.session, res)
})

router.get('/user', async (req, res) => {
	const userId = req.cookies.user
	if (!userId) {
		return res.status(400).send({ error: 'Missing user cookie' });
	}
	await db.findRespond('users', req.cookies.session, res, { user: userId })
})

router.post('/user/update', async (req, res) => {
	const id = toObjectId(getCookie(req.header('Cookie') || '', 'user'))
	if (!id) {
		return res.status(400).send({ error: 'Missing or invalid user cookie' });
	}
	await db.updateRespond('users', req.cookies.session, res, { _id: id }, { $set: { color: req.body.color } })
})

// Per-member colour theme. Only a short palette id is stored; the palettes
// themselves live in the frontend ($lib/theme.js), which falls back to the
// default for any id it doesn't know.
const THEME_ID = /^[a-z][a-z0-9-]{0,23}$/;

router.post('/user/theme', async (req, res) => {
	const id = toObjectId(getCookie(req.header('Cookie') || '', 'user'))
	if (!id) {
		return res.status(400).send({ error: 'Missing or invalid user cookie' });
	}
	const theme = req.body?.theme
	if (typeof theme !== 'string' || !THEME_ID.test(theme)) {
		return res.status(400).send({ error: 'Invalid theme' });
	}
	await db.updateRespond('users', req.cookies.session, res, { _id: id }, { $set: { theme } })
})

// Per-member: whether the assistant shows its changes for review before
// running them (default on).
router.post('/user/assistant', async (req, res) => {
	const id = toObjectId(getCookie(req.header('Cookie') || '', 'user'))
	if (!id) {
		return res.status(400).send({ error: 'Missing or invalid user cookie' });
	}
	const confirm = req.body?.confirm
	if (typeof confirm !== 'boolean') {
		return res.status(400).send({ error: 'Invalid setting' });
	}
	await db.updateRespond('users', req.cookies.session, res, { _id: id }, { $set: { assistantConfirm: confirm } })
})

router.post('/users/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	while (await db.delete('signatures', req.cookies.session, { who: id }));
	await db.deleteRespond('users', req.cookies.session, res, { _id: id })
});

export default router;
