import schedule from 'node-schedule'
import cors from 'cors';
import express from 'express';
import fs from 'fs';
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

	async insert(elem, collectionName, res) {
		try {
			const collection = this.db.collection(collectionName)
			const result = await collection.insert(elem)
			console.log(`${result.insertedCount} users inserted in db.`);
			res.status(201).send(documents);
		} catch (err) {
			console.error("Error inserting data in db:", err);
			res.status(500).send({error: err});
		}
	}

	async insert(elem, collectionName, res) {
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

	async find(collectionName, res, where = {}) {
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

	async delete(collectionName, res, where) {
		try {
			if (where == {})
				res.status(400).send({message: 'Cannot delete without where'});
			const result = await this.db.collection(collectionName).deleteOne(where);
	
			if (result.deletedCount === 0) {
				return res.status(404).send({error: `No element found with condition ${where}`});
			}
			res.status(200).send({message: `Object with condition ${where} deleted successfully`});
		} catch (error) {
			console.error('Error deleting data from db:', error);
			res.status(500).send({message: 'Error deleting data from db'});
		}
	}
}

////////////////////////////////////////////
// HELPERS

function getID(req, res) {
	let id = req.body;
	if (!id["id"]) {
		console.log("Missing id, stopping deletion")
		res.status(400).send({error: "Missing field"});
		return false
	}
	return id.id
}

////////////////////////////////////////////
// STARTUP ROUTINE

// Create db reference object
const db = new DB()
await db.connectDB()

app.use(cors({
    origin: 'http://' + 'backend' + ':' + String(PORT)
}));

app.use(express.json());

schedule.scheduleJob('0 0 * * *', () => {

})

////////////////////////////////////////////
// EVENTS

// Get all events
app.get('/events', async (req, res) => {
    await db.find('events', res)
});

// Add a new event
app.post('/events', async (req, res) => {
    const newEvent = req.body;
    await db.insert(newEvent, 'events', res)
});

// Delete event
app.post('/events/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	await db.delete('events', res, {_id: id})
});

////////////////////////////////////////////
// ROOMS

// Get all rooms
app.get('/rooms', async (req, res) => {
    await db.find('rooms', res)
});

// Add a new room
app.post('/rooms', async (req, res) => {
    const newRoom = req.body;
    await db.insert(newRoom, 'events', res)
});

// Delete a room
app.post('/rooms/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	await db.delete('rooms', res, {_id: id})
});

////////////////////////////////////////////
// CHORES

// Get all chores
app.get('/chores', async (req, res) => {
	await db.find('chores', res)
});

// Add a new chore
app.post('/chores', async (req, res) => {
    let newChore = req.body;
    if (!newChore["nextTime"] || !newChore["rooms"] || !newChore["name"]) {
		res.status(400).send('Missing field');
        return;
    }
	let chores = [];
    newChore.repetition = newChore.nextTime;
    let singleRoomChore = Object.assign({}, newChore);
    delete singleRoomChore.rooms;
    if (newChore.rooms.length == 0) {
        singleRoomChore.room = '';
        chores.push(singleRoomChore)
    } else {
        for (let room of newChore.rooms) {
            let newChoreSingleRoom = Object.assign({}, singleRoomChore);
            newChoreSingleRoom.room = room;
			newChoreSingleRoom.signatures = []
            chores.push(newChoreSingleRoom);
        }
    }
    await db.insertMany(chores, 'chores', res)
});

// Sign chore
app.post('/chores/sign', (req, res) => {
	let sign = req.body;
	if (!"id" in sign) {
		res.status(400).send(sign);
		return;
	}
	// TODO
	console.log(sign)
	// 
	res.status(201).send(sign);
});

// Delete chore
app.post('/chores/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	await db.delete('chores', res, {_id: id})
});

////////////////////////////////////////////
// USERS

app.get('/users', async (req, res) => {
	await db.find('users', res)
})

app.post('/users', async (req, res) => {
	await db.insert(req.body, 'users', res)
})

app.get('/user', async (req, res) => {
	const cookieSplit = req.header('Cookie').split('=')[1]
	await db.find('users', res, {user: cookieSplit})
})

app.post('/users/del', async (req, res) => {
	let id = getID(req, res)
	if (id == false)
		return
	id = new ObjectId(id)
	await db.delete('users', res, {_id: id})
});

////////////////////////////////////////////
// START SERVER

const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
