import schedule from 'node-schedule'
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import https from 'https';
import cookies from 'cookie-parser'
import { MongoClient, ObjectId } from 'mongodb';
const app = express();
const PORT = 3000;

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

	async insert(elem, collectionName) {
		try {
			const collection = this.db.collection(collectionName)
			console.log(elem)
			const result = await collection.insertOne(elem)
			console.log(`'${elem}' inserted in collection ${collectionName} in db.`);
		} catch (err) {
			console.error("Error inserting data in db:", err);
			return false
		}
		return true
	}

	async insertRespond(elem, collectionName, res) {
		try {
			const collection = this.db.collection(collectionName)
			const result = await collection.insertOne(elem)
			console.log(`'${elem}' inserted in collection ${collectionName} in db.`);
			res.status(201).send(result);
		} catch (err) {
			console.error("Error inserting data in db:", err);
			res.status(500).send({error: err});
		}
	}

	async insertMany(elem, collectionName, res) {
		try {
			const collection = this.db.collection(collectionName)
			const result = await collection.insertMany(elem)
			console.log(`${result.insertedCount} ${collectionName} inserted in db.`);
			res.status(201).send(result);
		} catch (err) {
			console.error("Error inserting data in db:", err);
			res.status(500).send({error: err});
		}
	}

	async findRespond(collectionName, res, where = {}) {
		try {
			const collection = this.db.collection(collectionName)
			const document = await collection.find(where).toArray();
			console.log(`${document.length} document retrieved from ${collectionName} from db.`);
			res.send(document);
		} catch (err) {
			console.error("Error retrieving data from db:", err);
			res.status(500).send({error: err});
		}
	}

	async find(collectionName, where = {}) {
		try {
			const collection = this.db.collection(collectionName)
			const document = await collection.find(where).toArray();
			console.log(`${document.length} document retrieved from ${collectionName} from db.`);
			return document;
		} catch (err) {
			console.error("Error retrieving data from db:", err);
			return 0;
		}
	}

	async deleteRespond(collectionName, res, where) {
		try {
			if (where == {})
				res.status(400).send({message: 'Cannot delete without where'});
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

	async delete(collectionName, where) {
		try {
			if (where == {})
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

	async updateRespond(collectionName, res, where, updated_data) {
		try {
			if (where == {})
				res.status(400).send({message: 'Cannot delete without where'});
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

	async update(collectionName, where, updated_data) {
		try {
			if (where == {})
				return false
			const result = await this.db.collection(collectionName).updateOne(where, updated_data);
			if (!result.updatedCount)
				return false
		} catch (error) {
			console.error('Error updating data from db:', error);
			return false	
		}
		return true
	}

	async scheduledUpdate() {
		try {
			const choresCollection = this.db.collection('chores'); // Your chores collection
			let result = await choresCollection.updateMany(
				{},
				{ $inc: { daysNextTime: -1 }, }
			);
			result = await choresCollection.updateMany(
				{ nextTime: { $lte: 30 } },
				{ $inc: { nextTime: -1 }, }
			);
			result = await choresCollection.updateMany(
			{ nextTime: { $gt: 30 } }, // Select documents where nextTime > 30
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
// EVENTS

// Get all events
app.get('/events', async (req, res) => {
    await db.findRespond('events', res)
});

// Add a new event
app.post('/events', async (req, res) => {
    const newEvent = req.body;
    await db.insertRespond(newEvent, 'events', res)
});

// Delete event
app.post('/events/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	await db.deleteRespond('events', res, {_id: id})
});

////////////////////////////////////////////
// ROOMS

// Get all rooms
app.get('/rooms', async (req, res) => {
    await db.findRespond('rooms', res)
});

// Add a new room
app.post('/rooms', async (req, res) => {
    const newRoom = req.body;
    await db.insertRespond(newRoom, 'rooms', res)
});

// Delete a room
app.post('/rooms/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	await db.deleteRespond('rooms', res, {_id: id})
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
	await db.findRespond('chores', res)
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

    await db.insertMany([newChore], 'chores', res);
});

// Sign chore
app.post('/chores/sign', async (req, res) => {
	let sign = req.body;
	if (!"rooms" in sign || !"notes" in sign || !'name' in sign) {
		res.status(400).send(sign);
		return;
	}
	sign.id = getID(req, res);
	if (!sign.id)
		return;

	// Find chore to update
	let chore = await db.find('chores', {_id: sign.id})
	chore = chore[0]

	// Change repetition if it has been updated
	if (sign.repetition != chore.repetition) {
		chore.repetition = sign.repetition;
		chore.nextTime = chore.repetition;
		calcNextTimeDays(chore);
	}

	if (sign.newRooms.length != chore.rooms.length || !sign.newRooms.every((nroom) => {return chore.rooms.findIndex((room) => {return nroom == room._id}) != -1})) {
		let all_rooms = await db.find('rooms')
		chore.rooms = sign.newRooms.map((nroom) => {
			let match = all_rooms.find((room) => {return nroom == room._id})
			if (match) {
				return {_id: nroom, name: match.name, done: false}
			}
		})
		console.log(chore.rooms)
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
	if (sign.rooms.length && sign.stats)
		await db.insert({date: Date.now(), delay: sign.nextTime, chore_ref: sign.id, who: req.cookies.user, rooms: sign.rooms}, 'signatures')
	await db.updateRespond('chores', res,
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
	while (await db.delete('signatures', {chore_ref: id}));
	await db.deleteRespond('chores', res, {_id: id})
});

////////////////////////////////////////////
// CHORES SIGNATURES
app.get('/chores/stats', async (req, res) => {
	return await db.findRespond('signatures', res)
})

app.get('/chores/stats/clear', async (req, res) => {
	await db.db.collection('signatures').drop()
	console.log('Reset signatures')
})


////////////////////////////////////////////
// USERS

app.get('/users', async (req, res) => {
	await db.findRespond('users', res)
})

app.post('/users', async (req, res) => {
	await db.insertRespond(req.body, 'users', res)
})

app.get('/user', async (req, res) => {
	const cookieSplit = req.header('Cookie').split('=')[1]
	await db.findRespond('users', res, {user: cookieSplit})
})

app.post('/users/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	await db.deleteRespond('users', res, {_id: id})
});

////////////////////////////////////////////
// START SERVER

https.createServer(sslOptions, app).listen(PORT, () => {
	console.log(`Server running on https://localhost:${PORT}`);
});
