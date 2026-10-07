import { Router } from 'express';
import db, { ObjectId } from './db.js';

const router = Router();

router.get('/events', async (req, res) => {
    try {
        const events = await db.find('events', req.cookies.session);
        if (!events) return res.status(401).send({ error: 'Unauthorized' });

        const { startDate, endDate } = req.query;
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            const relevantEvents = events.filter(event => {
                if (!event.repeatDays) {
                    const eventDate = new Date(event.when);
                    return eventDate >= start && eventDate <= end;
                }

                const eventStart = new Date(event.when);
                if (eventStart > end) return false;

                const daysDiff = Math.floor((end - eventStart) / (1000 * 60 * 60 * 24));
                if (daysDiff >= 0) {
                    const firstOccurrenceInRange = new Date(eventStart);
                    while (firstOccurrenceInRange < start) {
                        firstOccurrenceInRange.setDate(firstOccurrenceInRange.getDate() + event.repeatDays);
                    }
                    return firstOccurrenceInRange <= end;
                }

                return false;
            });

            const expandedEvents = relevantEvents.flatMap(event => {
                if (!event.repeatDays) {
                    return event;
                }

                const occurrences = [];
                let occurrenceDate = new Date(event.when);

                while (occurrenceDate < start) {
                    occurrenceDate.setDate(occurrenceDate.getDate() + event.repeatDays);
                }

                while (occurrenceDate <= end) {
                    occurrences.push({
                        ...event,
                        when: new Date(occurrenceDate).toISOString(),
                        isOccurrence: true,
                        originalEventId: event._id,
                        originalEventDate: event.when
                    });
                    occurrenceDate.setDate(occurrenceDate.getDate() + event.repeatDays);
                }

                return occurrences.length > 0 ? occurrences : [];
            });

            return res.send(expandedEvents);
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

		const result = await db.update('events', req.cookies.session, { _id: id }, { $set: updatedEvent });
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
