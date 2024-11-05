import schedule from 'node-schedule'
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import { MongoClient, ObjectId } from 'mongodb';
const app = express();
const PORT = 3000;

const mongoUri = process.env.MONGO_URI || "mongodb://database:27017/db";

async function connectDB() {
	const client = new MongoClient(mongoUri);
	await client.connect();
	console.log("Connected to MongoDB");
	return client.db();
}

app.use(cors({
    origin: 'http://backend:3000'
}));

app.use(express.json()); // Middleware to parse JSON bodies

// In-memory storage for events
let events = [];

// Load events from file on startup
function loadEvents() {
    fs.readFile('events.json', 'utf8', (err, data) => {
        if (!err) {
            events = JSON.parse(data);
        }
    });
}

// Write events to file
function saveEvents() {
    let json_events = JSON.stringify(events, 2, null)
    fs.writeFileSync('events.json', json_events, (err) => {
        if (err) {
            console.error("Error saving events:", err);
        }
    });
}

let rooms = []
// Load rooms from file on startup
function loadRooms() {
    fs.readFile('rooms.json', 'utf8', (err, data) => {
        if (!err) {
            rooms = JSON.parse(data);
        }
    });
}

// Write events to file
function saveRooms() {
    let json_rooms = JSON.stringify(rooms, 2, null)
    fs.writeFileSync('rooms.json', json_rooms, (err) => {
        if (err) {
            console.error("Error saving events:", err);
        }
    });
}

// Write events to file
async function saveChores(chores) {
    // let json_chores = JSON.stringify(chores, 2, null)
    // fs.writeFileSync('chores.json', json_chores, (err) => {
    //     if (err) {
    //         console.error("Error saving chores:", err);
    //     }
    // });
	try {
		const db = await connectDB();
		console.log('chores: ', chores)
		const collection = db.collection('chores')
		const result = await collection.insertMany(chores)
		console.log(`${result.insertedCount} documents inserted in db.`);
		return 0;
	} catch (err) {
		console.error("Error inserting data in db:", err);
		return 1;
	}
}

// Load data when server starts
loadEvents();
loadRooms();

// Get all events
app.get('/events', (req, res) => {
    res.send(events);
});

// Add a new event
app.post('/events', (req, res) => {
    const newEvent = req.body;
    events.push(newEvent);
    saveEvents()
    res.status(201).send(newEvent);
});

// Get all rooms
app.get('/rooms', (req, res) => {
    res.send(rooms);
});

// Add a new room
app.post('/rooms', (req, res) => {
    const newRoom = req.body;
    rooms.push(newRoom);
    saveRooms()
    res.status(201).send(newRoom);
});


// Get all chores
app.get('/chores', async (req, res) => {
    try {
		const db = await connectDB();
		const collection = db.collection('chores')
		const chores = await collection.find({}).toArray();
		console.log(`${chores.length} documents retrieved from db.`);
		res.send(chores);
	} catch (err) {
		console.error("Error retrieving data from db:", err);
		res.status(500).send({error: err});
	}
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
    if (await saveChores(chores) == 0)
	    res.status(201).send(newChore);
	else
		res.status(500).send(newChore);
});

app.post('/chores/sign', (req, res) => {
    let sign = req.body;
    if (!"id" in sign) {
        res.status(400).send(sign);
        return;
    }
    console.log(sign)
    // TODO
    res.status(201).send(sign);
});


// Delete chore
app.post('/chores/del', async (req, res) => {
    let id = req.body;
    if (!id["id"]) {
		console.log("Missing id, stopping deletion")
        return res.status(400).send({error: "Missing field"});
    }
	try {
        const db = await connectDB();
		const objId = new ObjectId(String(id.id))
        const result = await db.collection('chores').deleteOne({ _id:  objId});

        if (result.deletedCount === 0) {
            return res.status(404).send({error: 'No chore found with that ID'});
        }
		console.log("Success: ", id.id)
        res.status(200).send({message: 'Chore deleted successfully'});
    } catch (error) {
        console.error('Error deleting chore:', error);
        res.status(500).send({message: 'Error deleting chore'});
    }
});

schedule.scheduleJob('0 0 * * *', () => {

})

// Start the server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
