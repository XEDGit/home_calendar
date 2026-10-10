import { Router } from 'express';
import db, { ObjectId } from './db.js';
import { expandEvents } from './eventRepeat.js';

const router = Router();

router.get('/events', async (req, res) => {
    try {
        const events = await db.find('events', req.cookies.session);
        if (!events) return res.status(401).send({ error: 'Unauthorized' });

        const { startDate, endDate } = req.query;
        if (startDate && endDate) {
            // Repeats are worked out on the household's wall clock (eventRepeat.js)
            return res.send(expandEvents(events, new Date(startDate), new Date(endDate)));
        }

        res.send(events);
    } catch (err) {
        console.error('Error retrieving events:', err);
        res.status(500).send({ error: 'Internal server error' });
    }
});

router.post('/events', async (req, res) => {
    const newEvent = req.body;

    if (newEvent.repeatInterval) {
        const repeatMapping = {
            daily: 1,
            weekly: 7,
            monthly: 30,
            yearly: 365
        };

        if (!repeatMapping[newEvent.repeatInterval]) {
            return res.status(400).send({ error: 'Invalid repeat interval' });
        }

        newEvent.repeatDays = repeatMapping[newEvent.repeatInterval];
    }

    await db.insertRespond(newEvent, 'events', req.cookies.session, res);
});

router.post('/updateEvent', async (req, res) => {
	const updatedEvent = req.body;
	if (!updatedEvent._id) {
		return res.status(400).send({ success: false, message: 'Missing event ID' });
	}

	try {
		const id = new ObjectId(updatedEvent._id);
		delete updatedEvent._id;

		const existingEvent = await db.find('events', req.cookies.session, { _id: id });
		if (!existingEvent || existingEvent.length === 0) {
			return res.status(404).send({ success: false, message: 'Event not found' });
		}

		if (updatedEvent.repetition) {
			const repeatMapping = {
				daily: 1,
				weekly: 7,
				monthly: 30,
				yearly: 365,
				none: 0
			};

			if (repeatMapping[updatedEvent.repetition] !== undefined) {
				updatedEvent.repeatDays = repeatMapping[updatedEvent.repetition];
			} else {
				delete updatedEvent.repetition;
			}
		} else if (updatedEvent.repetition === 'none') {
			updatedEvent.repeatDays = 0;
		}

		// Fields of a generated repeat (eventRepeat.js) never belong on the
		// series; older forms saved them along with an edit, so clear them
		const REPEAT_ONLY = ['isOccurrence', 'originalEventId', 'originalEventDate'];
		for (const key of REPEAT_ONLY) delete updatedEvent[key];
		const result = await db.update('events', req.cookies.session, { _id: id }, {
			$set: updatedEvent,
			$unset: Object.fromEntries(REPEAT_ONLY.map(key => [key, ''])),
		});
		if (result) {
			const updatedDoc = await db.find('events', req.cookies.session, { _id: id });
			if (updatedDoc && updatedDoc.length > 0) {
				return res.status(200).send({ success: true, event: updatedDoc[0] });
			}
			return res.status(200).send({ success: true });
		} else {
			return res.status(500).send({ success: false, message: 'Failed to update event' });
		}
	} catch (error) {
		console.error('Error updating event:', error);
		return res.status(500).send({ success: false, message: 'Internal server error' });
	}
});

router.post('/deleteEvent', async (req, res) => {
	if (!req.body.id) {
		return res.status(400).send({ success: false, message: 'Missing event ID' });
	}

	try {
		const id = new ObjectId(req.body.id);

		const existingEvent = await db.find('events', req.cookies.session, { _id: id });
		if (!existingEvent || existingEvent.length === 0) {
			return res.status(404).send({ success: false, message: 'Event not found' });
		}

		const result = await db.delete('events', req.cookies.session, { _id: id });
		if (result) {
			return res.status(200).send({ success: true });
		} else {
			return res.status(500).send({ success: false, message: 'Failed to delete event' });
		}
	} catch (error) {
		console.error('Error deleting event:', error);
		return res.status(500).send({ success: false, message: 'Internal server error' });
	}
});

export default router;
