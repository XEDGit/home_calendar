import schedule from 'node-schedule'
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import https from 'https';
import cookies from 'cookie-parser'
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { MongoClient, ObjectId } from 'mongodb';
const app = express();
const PORT = 3000;
const SECRET = process.env.SECRET
const saltRounds = 10

////////////////////////////////////////////
// DATABASE REFERENCE

class DB {
	constructor() {
		this.mongoUri = process.env.MONGO_URI || "mongodb://database:27017/db";
		this.db = null;
	}

	async connectDB() {
		const client = new MongoClient(this.mongoUri);
		await client.connect();
		console.log("Connected to MongoDB");
		this.db = client.db();
	}

	getSession(token) {
		try {
			return jwt.verify(token, SECRET).session;
		} catch {
			console.log('Failed to get session from jwt')
			return 0
		}
	}

	async insert(elem, collectionName, session) {
		try {
			const collection = this.db.collection(collectionName)
			if (session)
				elem.session = this.getSession(session)
			else
				return false
			const result = await collection.insertOne(elem)
			console.log(`'${elem}' inserted in collection ${collectionName} in db.`);
		} catch (err) {
			console.error("Error inserting data in db:", err);
			return false
		}
		return true
	}

	async insertRespond(elem, collectionName, session, res) {
		try {
			if (session)
				elem.session = this.getSession(session)
			else {
				res.status(401).send({error: "Missing session token"});
				return
			}
			const collection = this.db.collection(collectionName)
			const result = await collection.insertOne(elem)
			console.log(`'${elem}' inserted in collection ${collectionName} in db.`);
			res.status(201).send(result);
		} catch (err) {
			console.error("Error inserting data in db:", err);
			res.status(500).send({error: err});
		}
	}

	async insertMany(elem, collectionName, session, res) {
		try {
			if (session) {
				session = this.getSession(session)
				elem.forEach((el) => {el.session = session;})
			}
			else {
				res.status(401).send({error: "Missing session token"});
				return
			}
			const collection = this.db.collection(collectionName)
			const result = await collection.insertMany(elem)
			console.log(`${result.insertedCount} ${collectionName} inserted in db.`);
			res.status(201).send(result);
		} catch (err) {
			console.error("Error inserting data in db:", err);
			res.status(500).send({error: err});
		}
	}

	async findRespond(collectionName, session, res, where = {}) {
		try {
			if (session)
				where = {...where, 'session': this.getSession(session)}
			else {
				res.status(401).send({error: "Missing session token"});
				return
			}
			const collection = this.db.collection(collectionName)
			const document = await collection.find(where).toArray();
			console.log(`${document.length} document retrieved from ${collectionName} from db.`);
			res.send(document);
		} catch (err) {
			console.error("Error retrieving data from db:", err);
			res.status(500).send({error: err});
		}
	}

	async findLogin(username) {
		try {
			const collectionName = 'sessions'
			const collection = this.db.collection(collectionName)
			const document = await collection.find({"username": username}).toArray();
			console.log(`${document.length} document retrieved from ${collectionName} from db.`);
			return document;
		} catch (err) {
			console.error("Error retrieving data from db:", err);
			return false;
		}
	}

	async findVerify(session) {
		try {
			const collectionName = 'sessions'
			const collection = this.db.collection(collectionName)
			const document = await collection.find({"session": session}).toArray();
			console.log(`${document.length} document retrieved from ${collectionName} from db.`);
			return document;
		} catch (err) {
			console.error("Error retrieving data from db:", err);
			return false;
		}
	}
	
	async find(collectionName, session, where = {}) {
		try {
			if (session)
				where = {...where, 'session': this.getSession(session)}
			else
				return false;
			const collection = this.db.collection(collectionName)
			const document = await collection.find(where).toArray();
			console.log(`${document.length} document retrieved from ${collectionName} from db.`);
			return document;
		} catch (err) {
			console.error("Error retrieving data from db:", err);
			return false;
		}
	}

	async deleteRespond(collectionName, session, res, where) {
		try {
			if (where == {})
				res.status(400).send({message: 'Cannot delete without where'});
			if (session)
				where = {...where, 'session': this.getSession(session)}
			else {
				res.status(401).send({error: "Missing session token"});
				return
			}
			const result = await this.db.collection(collectionName).deleteOne(where);
	
			if (result.deletedCount === 0) {
				return res.status(404).send({error: `No element found with condition ${where}`});
			}
			console.log('Deleted ', result.deletedCount, ' from ', collectionName)
			res.status(200).send({message: `Object with condition ${where} deleted successfully`});
		} catch (error) {
			console.error('Error deleting data from db:', error);
			res.status(500).send({message: 'Error deleting data from db'});
		}
	}

	async delete(collectionName, session, where) {
		try {
			if (where == {})
				return false;
			if (session)
				where = {...where, 'session': this.getSession(session)}
			else
				return false;
			const result = await this.db.collection(collectionName).deleteOne(where);
	
			console.log('Deleted ', result.deletedCount, ' from ', collectionName)
			if (result.deletedCount === 0) {
				return false;
			}
			return true;
		} catch (error) {
			console.error('Error deleting data from db:', error);
			return false;
		}
	}

	async updateRespond(collectionName, session, res, where, updated_data) {
		try {
			if (where == {})
				res.status(400).send({message: 'Cannot update without where'});
			if (session)
				where = {...where, 'session': this.getSession(session)}
			else {
				res.status(401).send({error: "Missing session token"});
				return
			}
			const result = await this.db.collection(collectionName).updateOne(where, updated_data);
	
			if (result.updatedCount === 0) {
				return res.status(404).send({error: `No element found with condition ${where}`});
			}
			res.status(200).send({message: `Object with condition ${where} updated successfully`});
		} catch (error) {
			console.error('Error updating data from db:', error);
			res.status(500).send({message: 'Error updating data from db'});
		}
	}

	async update(collectionName, session, where, updated_data) {
		try {
			if (Object.keys(where).length == 0)
				return false
			if (session)
				where = {...where, 'session': this.getSession(session)}
			else
				return false
			const result = await this.db.collection(collectionName).updateOne(where, updated_data);
			if (!result.matchedCount)
				return false
		} catch (error) {
			console.error('Error updating data from db:', error);
			return false	
		}
		return true
	}

	async scheduledUpdate() {
		try {
			const choresCollection = this.db.collection('chores');
			let result = await choresCollection.updateMany(
				{},
				{ $inc: { daysNextTime: -1 }, }
			);
			result = await choresCollection.updateMany(
				{ nextTime: { $lte: 30 } },
				{ $inc: { nextTime: -1 }, }
			);
			result = await choresCollection.updateMany(
			{ nextTime: { $gt: 30 } },
				[
					{
						$set: {
							nextTime: {
								$floor: {
									$add: [
										{ $divide: ["$daysNextTime", 30] },
										30
									]
								}
							}
						}
					}
				]
			);
			console.log(`Periodical Update: Updated chores.`);
		} catch (err) {
			console.error("Periodical Update: Error updating chores:", err);
		}
	}
}

////////////////////////////////////////////
// HELPERS

function getID(req, res) {
	let id = req.body;
	if (!id["id"]) {
		res.status(400).send({error: "Missing id field"});
		return false
	}
	return new ObjectId(id.id)
}

function getCookie(cookieString, name) {
	const cookieArr = cookieString.split(';');
	for (let i = 0; i < cookieArr.length; i++) {
		let cookie = cookieArr[i].trim();
		if (cookie.startsWith(name + '=')) {
			return cookie.substring(name.length + 1, cookie.length);
		}
	}
	return null;
}

////////////////////////////////////////////
// STARTUP ROUTINE

// Create db reference object
const db = new DB()
await db.connectDB()

app.use(cors({
	origin: 'http://' + 'frontend' + ':' + String(PORT)
}));

app.use(express.json());

app.use(cookies())

schedule.scheduleJob('0 0 * * *', () => {
	db.scheduledUpdate();
})

const sslOptions = {
	key: fs.readFileSync('keys/private.key'),
	cert: fs.readFileSync('keys/certificate.crt'),
	ca: fs.readFileSync('keys/ca_bundle.crt'),
};


////////////////////////////////////////////
// LOGIN

app.post('/login', async (req, res) => {
	let { username, password } = req.body
	const result = await db.findLogin(username)
	if (result == false || result.length == 0 || !bcrypt.compareSync(password, result[0].password)) {
		return res.status(401).send({error: 'Internal error'})
	}
	console.log('Logged in ', username)
	const sessionToken = jwt.sign({session: result[0].session}, SECRET, {})
	const expiry = new Date()
	expiry.setMonth(expiry.getMonth() + 1)
	res.cookie('session', sessionToken, {expires: expiry})
	return res.status(200).send({})
});

////////////////////////////////////////////
// SESSIONS

app.post('/sessions', async (req, res) => {
	let { username, password } = req.body
	const result = await db.find('sessions', null, {'username': username})
	if (result == false || result.length == 0) {
		return await db.insertRespond({'session': crypto.randomBytes(64).toString('hex'), 'username': username, 'password': bcrypt.hashSync(password, saltRounds)}, 'sessions', null, res)
	}
	return res.status(401).send({error: 'Already existing'})
})

app.post('/verify', async (req, res) => {
	try {
		const { token } = req.body;
		if (token == undefined) {
			throw Error('session token not found in request body')
		}
		const decoded = jwt.verify(token, SECRET);
		const result = await db.findVerify(decoded.session)
		if (result == false || result.length == 0) {
			throw Error('session token not found in db')
		}
		res.status(200).send({})
	} catch (err) {
		console.error('Token verification failed:', err.message);
		res.status(401).send({})
	}
})

////////////////////////////////////////////
// EVENTS

// Get all events
app.get('/events', async (req, res) => {
    try {
        const events = await db.find('events', req.cookies.session);
        
        // If client requests expanded occurrences with date range, calculate them efficiently
        const { startDate, endDate } = req.query;
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            // Only send events relevant to the requested date range
            const relevantEvents = events.filter(event => {
                // For non-repeating events, check if they're in range
                if (!event.repeatDays) {
                    const eventDate = new Date(event.when);
                    return eventDate >= start && eventDate <= end;
                }
                
                // For repeating events, check if any occurrence falls in the range
                const eventStart = new Date(event.when);
                // If event starts after end date, no occurrences in range
                if (eventStart > end) return false;
                
                // Find the latest occurrence before or at the end date
                const daysDiff = Math.floor((end - eventStart) / (1000 * 60 * 60 * 24));
                // If at least one occurrence happens before the end date
                if (daysDiff >= 0) {
                    // Check if any occurrence falls within range
                    const firstOccurrenceInRange = new Date(eventStart);
                    // Adjust to first occurrence in or after start date
                    while (firstOccurrenceInRange < start) {
                        firstOccurrenceInRange.setDate(firstOccurrenceInRange.getDate() + event.repeatDays);
                    }
                    return firstOccurrenceInRange <= end;
                }
                
                return false;
            });
            
            // For repeating events, generate occurrences only within the date range
            const expandedEvents = relevantEvents.flatMap(event => {
                if (!event.repeatDays) {
                    return event;
                }
                
                const occurrences = [];
                let occurrenceDate = new Date(event.when);
                
                // Find the first occurrence that falls within range
                while (occurrenceDate < start) {
                    occurrenceDate.setDate(occurrenceDate.getDate() + event.repeatDays);
                }
                
                // Add all occurrences within range
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
        
        // If no date range provided, return the base events without expansion
        res.send(events);
    } catch (err) {
        console.error('Error retrieving events:', err);
        res.status(500).send({ error: 'Internal server error' });
    }
});

// Add a new event
app.post('/events', async (req, res) => {
    const newEvent = req.body;

    // Check for repeat interval
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

// Update event
app.post('/updateEvent', async (req, res) => {
	const updatedEvent = req.body;
	if (!updatedEvent._id) {
		return res.status(400).send({ success: false, message: 'Missing event ID' });
	}
	
	try {
		const id = new ObjectId(updatedEvent._id);
		delete updatedEvent._id; // Remove _id from the update data
		
		// Check if event exists for this session
		const existingEvent = await db.find('events', req.cookies.session, { _id: id });
		if (!existingEvent || existingEvent.length === 0) {
			return res.status(404).send({ success: false, message: 'Event not found' });
		}
		
		 // Process repetition if present
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
				delete updatedEvent.repetition; // Invalid repetition value
			}
		} else if (updatedEvent.repetition === 'none') {
			// If repetition is explicitly set to none, remove repetition
			updatedEvent.repeatDays = 0;
		}
		
		// Update the event
		const result = await db.update('events', req.cookies.session, { _id: id }, { $set: updatedEvent });
		if (result) {
			// Get the updated event to return to client
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

// Delete event
app.post('/deleteEvent', async (req, res) => {
	if (!req.body.id) {
		return res.status(400).send({ success: false, message: 'Missing event ID' });
	}
	
	try {
		const id = new ObjectId(req.body.id);
		
		// Check if event exists for this session
		const existingEvent = await db.find('events', req.cookies.session, { _id: id });
		if (!existingEvent || existingEvent.length === 0) {
			return res.status(404).send({ success: false, message: 'Event not found' });
		}
		
		// Delete the event
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


////////////////////////////////////////////
// TODOS

// Get all todos
app.get('/todos', async (req, res) => {
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

// Add a new todo
app.post('/todos', async (req, res) => {
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

// Update todo
app.post('/updateTodo', async (req, res) => {
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
		delete updatedTodo._id; // Remove _id from the update data
		delete updatedTodo.user; // Remove _id from the update data
		
		// Check if todo exists for this session
		const existingTodo = await db.find('todos', req.cookies.session, { _id: id });
		if (!existingTodo || existingTodo.length === 0 || (existingTodo[0].user != req.cookies.user && !existingTodo[0].shared)) {
			return res.status(404).send({ success: false, message: 'Todo not found' });
		}
		
		// Update the todo
		const result = await db.update('todos', req.cookies.session, { _id: id }, { $set: updatedTodo });
		if (result) {
			// Get the updated todo to return to client
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

// Delete todo
app.post('/deleteTodo', async (req, res) => {
	if (!req.cookies.user || !req.cookies.session) {
		return res.status(400).send({ error: 'Missing authorization' });
	}
	if (!req.body.id) {
		return res.status(400).send({ success: false, message: 'Missing todo ID' });
	}
	
	try {
		const id = new ObjectId(req.body.id);
		
		// Check if todo exists for this session
		const existingTodo = await db.find('todos', req.cookies.session, { _id: id, user: req.cookies.user });
		if (!existingTodo || existingTodo.length === 0 || existingTodo[0].user != req.cookies.user) {
			return res.status(404).send({ success: false, message: 'Todo not found' });
		}

		// Delete the todo
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

////////////////////////////////////////////
// TAGS

// Get all tags for the current user
app.get('/tags', async (req, res) => {
	if (!req.cookies.user || !req.cookies.session) {
		return res.status(400).send({ error: 'Missing authorization' });
	}
	try {
		const tagsDoc = await db.find('tags', req.cookies.session, { user: req.cookies.user });
		if (tagsDoc && tagsDoc.length > 0) {
			res.status(200).send(tagsDoc[0].tags || []); // Send the array of tags or empty if none
		} else {
			res.status(200).send([]); // No tags found for this user, return empty array
		}
	} catch (error) {
		console.error('Error fetching tags:', error);
		res.status(500).send({ error: 'Internal server error' });
	}
});

// Add a new tag for the current user
app.post('/tags', async (req, res) => {
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
		// Try to update first (add tag to existing array)
		const updateResult = await db.update('tags', session,
			{ user: user },
			{ $addToSet: { tags: trimmedTag } } // $addToSet prevents duplicates
		);

		if (updateResult) {
			// If update was successful (document existed and tag was added or already present)
			res.status(200).send({ success: true, message: 'Tag added or already exists' });
		} else {
			// If update failed (likely because the document didn't exist), insert a new one
			const insertData = {
				user: user,
				tags: [trimmedTag]
			};
			// Use insertRespond which handles session automatically
			await db.insertRespond(insertData, 'tags', session, res);
		}
	} catch (error) {
		console.error('Error adding tag:', error);
		res.status(500).send({ error: 'Internal server error' });
	}
});

// Delete a tag for the current user
app.post('/deleteTag', async (req, res) => {
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
			{ $pull: { tags: trimmedTag } } // $pull removes the specified tag from the array
		);

		if (result) {
			res.status(200).send({ success: true, message: 'Tag deleted successfully' });
		} else {
			// This could mean the tag document wasn't found, or the tag wasn't in the array
			res.status(404).send({ success: false, message: 'Tag or user tag document not found' });
		}
	} catch (error) {
		console.error('Error deleting tag:', error);
		res.status(500).send({ error: 'Internal server error' });
	}
});


////////////////////////////////////////////
// ROOMS

// Get all rooms
app.get('/rooms', async (req, res) => {
	await db.findRespond('rooms', req.cookies.session, res)
});

// Add a new room
app.post('/rooms', async (req, res) => {
	const newRoom = req.body;
	await db.insertRespond(newRoom, 'rooms', req.cookies.session, res)
});

// Delete a room
app.post('/rooms/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	await db.deleteRespond('rooms', req.cookies.session, res, {_id: id})
});

////////////////////////////////////////////
// CHORES

// Debug daily schedule
app.get('/chores/dbg', async (req, res) => {
	await db.scheduledUpdate()
	return res.status(200).send({})
});

// Get all chores
app.get('/chores', async (req, res) => {
	await db.findRespond('chores', req.cookies.session, res)
});

function calcNextTimeDays(newChore) {
	newChore.daysNextTime = newChore.nextTime;

	if (newChore.nextTime > 30) {
		let currentDate = new Date(); // Today's date
		let targetDate = new Date(currentDate); // Clone current date
		// If nextTime is in months, add the months
		let monthsToAdd = Math.round(newChore.nextTime - 30); // Convert approximate days to months
		targetDate.setMonth(currentDate.getMonth() + monthsToAdd);
		newChore.daysNextTime = Math.round((targetDate - currentDate) / (1000 * 60 * 60 * 24)); // Calculate in days
	}

	if (newChore.nextTime == 1) {
		newChore.timeMeasure = 'day';
	} else if (newChore.nextTime < 31) {
		newChore.timeMeasure = 'days';
	} else if (newChore.nextTime == 31) {
		newChore.timeMeasure = 'month';
	} else if (newChore.nextTime > 31) {
		newChore.timeMeasure = 'months';
	}
}

// Add a new chore
app.post('/chores', async (req, res) => {
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

// Sign chore
app.post('/chores/sign', async (req, res) => {
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

	// Find chore to update
	let chore = await db.find('chores', req.cookies.session, {_id: sign.id})
	if (!chore.length) {
		res.status(400).send({error: 'No chore found to sign'});
		console.log('ERROR: No chores found to sign')
		return
	}
	chore = chore[0]

	// Change repetition if it has been updated
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

	// Change amount of rooms done
	chore.rooms.forEach((room) => {
		for (let id of sign.rooms) {
			if (room._id == id)
				room.done = true;
		}
	})
	
	// Reset value of nextTime to repetition and recalculate daysNextTime if all rooms are done
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

// Delete chore
app.post('/chores/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	while (await db.delete('signatures', req.cookies.session, {chore_ref: id}));
	await db.deleteRespond('chores', req.cookies.session, res, {_id: id})
});

////////////////////////////////////////////
// CHORES SIGNATURES
app.get('/chores/stats', async (req, res) => {
	return await db.findRespond('signatures', req.cookies.session, res)
})

app.post('/chores/stats/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	await db.deleteRespond('signatures', req.cookies.session, res, {_id: id})
});

app.get('/chores/stats/clear', async (req, res) => {
	while (await db.delete('signatures', req.cookies.session, res, {who: undefined}));
})

////////////////////////////////////////////
// USERS

app.get('/users', async (req, res) => {
	await db.findRespond('users', req.cookies.session, res)
})

app.post('/users', async (req, res) => {
	const newUser = req.body
	await db.insertRespond(newUser, 'users', req.cookies.session, res)
})

app.get('/user', async (req, res) => {
	const cookieSplit = req.header('Cookie').split('=')[1]
	await db.findRespond('users', req.cookies.session, res, {user: cookieSplit})
})

app.post('/user/update', async (req, res) => {
	const cookieSplit = getCookie(req.header('Cookie'), 'user')
	await db.updateRespond('users', req.cookies.session, res, {_id: new ObjectId(cookieSplit)}, {$set: {color: req.body.color}})
})

app.post('/users/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	while (await db.delete('signatures', req.cookies.session, {who: id}));
	await db.deleteRespond('users', req.cookies.session, res, {_id: id})
});

////////////////////////////////////////////
// START SERVER

https.createServer(sslOptions, app).listen(PORT, () => {
	console.log(`Server running on https://localhost:${PORT}`);
});
