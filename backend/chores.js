import { Router } from 'express';
import db, { ObjectId } from './db.js';
import { getID } from './helpers.js';
import { calcNextTimeDays, resetChore } from './choreTime.js';

const router = Router();

// Debug-only: runs the nightly recompute across ALL tenants. Disabled in
// production and POST-only so it cannot be triggered via a cross-site GET.
router.post('/chores/dbg', async (req, res) => {
	if (process.env.NODE_ENV === 'production') {
		return res.status(404).send({ error: 'Not found' });
	}
	await db.scheduledUpdate()
	return res.status(200).send({})
});

router.get('/chores', async (req, res) => {
	await db.findRespond('chores', req.cookies.session, res)
});

router.post('/chores', async (req, res) => {
	let newChore = req.body;
	if (!newChore["nextTime"] || !newChore["rooms"] || !newChore["name"]) {
		res.status(400).send('Missing field');
		return;
	}
	newChore.repetition = newChore.nextTime;
	newChore.rooms.forEach(room => room.done = false);
	calcNextTimeDays(newChore);

	await db.insertMany([newChore], 'chores', req.cookies.session, res);
});

router.post('/chores/sign', async (req, res) => {
	let sign = req.body;
	if (!"rooms" in sign || !"notes" in sign || !'name' in sign) {
		res.status(400).send(sign);
		return;
	}
	sign.id = getID(req, res);
	if (!sign.id) {
		res.status(400).send({error: 'missing chore id'});
		return;
	}

	if (req.cookies.user == undefined) {
		res.status(400).send({error: 'missing user, refresh the page'});
		return
	}

	let chore = await db.find('chores', req.cookies.session, {_id: sign.id})
	if (!chore.length) {
		res.status(400).send({error: 'No chore found to sign'});
		console.log('ERROR: No chores found to sign')
		return
	}
	chore = chore[0]

	if (sign.repetition != chore.repetition) {
		chore.repetition = sign.repetition;
		chore.nextTime = chore.repetition;
		calcNextTimeDays(chore);
	}

	if (sign['newRooms'] && (sign.newRooms.length != chore.rooms.length || !sign.newRooms.every((nroom) => {return chore.rooms.findIndex((room) => {return nroom == room._id}) != -1}))) {
		let all_rooms = await db.find('rooms', req.cookies.session)
		chore.rooms = sign.newRooms.map((nroom) => {
			let match = all_rooms.find((room) => {return nroom == room._id})
			if (match) {
				return {_id: nroom, name: match.name, done: false}
			}
		})
	}

	chore.rooms.forEach((room) => {
		for (let id of sign.rooms) {
			if (room._id == id)
				room.done = true;
		}
	})

	if (chore.rooms.every(room => room.done)) {
		chore.nextTime = chore.repetition;
		calcNextTimeDays(chore);
		chore.rooms.forEach((room) => {
			room.done = false;
		})
	}

	chore.name = sign.name;
	if (sign.rooms.length && sign.stats) {
		console.log('Recording stats in db')
		await db.insert({date: Date.now(), delay: sign.nextTime, chore_ref: sign.id, who: sign.who, rooms: sign.rooms}, 'signatures', req.cookies.session)
	}
	await db.updateRespond('chores', req.cookies.session, res,
		{_id: sign.id},
		{
			$set: {
				rooms: chore.rooms,
				nextTime: chore.nextTime,
				notes: sign.notes,
				name: chore.name,
				daysNextTime: chore.daysNextTime,
				repetition: chore.repetition,
				timeMeasure: chore.timeMeasure,
			}
		}
	)
});

router.post('/chores/skip', async (req, res) => {
	let id = getID(req, res);
	if (!id) return;

	let chore = await db.find('chores', req.cookies.session, { _id: id });
	if (!chore.length) {
		res.status(400).send({ error: 'No chore found' });
		return;
	}
	chore = chore[0];

	chore.nextTime = chore.repetition;
	calcNextTimeDays(chore);

	await db.updateRespond('chores', req.cookies.session, res,
		{ _id: id },
		{
			$set: {
				nextTime: chore.nextTime,
				daysNextTime: chore.daysNextTime,
				timeMeasure: chore.timeMeasure,
			}
		}
	);
});

// Back from a holiday: every chore's countdown restarts at its full interval
// from today, like Skip on each one. Nothing is signed, stats stay as they are.
router.post('/chores/reset', async (req, res) => {
	const chores = await db.find('chores', req.cookies.session);
	if (!chores) {
		res.status(401).send({ error: 'Unauthorized' });
		return;
	}
	let reset = 0;
	for (const chore of chores) {
		const fields = resetChore(chore);
		if (fields && await db.update('chores', req.cookies.session, { _id: chore._id }, { $set: fields })) reset++;
	}
	res.status(200).send({ reset });
});

router.post('/chores/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	while (await db.delete('signatures', req.cookies.session, {chore_ref: id}));
	await db.deleteRespond('chores', req.cookies.session, res, {_id: id})
});

router.get('/chores/stats', async (req, res) => {
	return await db.findRespond('signatures', req.cookies.session, res)
})

router.post('/chores/stats/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	await db.deleteRespond('signatures', req.cookies.session, res, {_id: id})
});

router.post('/chores/stats/clear', async (req, res) => {
	try {
		// Remove malformed signatures (no recorded user), scoped to the tenant.
		while (await db.delete('signatures', req.cookies.session, { who: null }));
		return res.status(200).send({ message: 'Cleared' });
	} catch (err) {
		console.error('Error clearing stats:', err);
		return res.status(500).send({ error: 'Internal server error' });
	}
})

export default router;
