const cors = require('cors');
const express = require('express');
const fs = require('fs');
const app = express();
const PORT = 3000;

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

let chores = []
// Load chores from file on startup
function loadChores() {
    fs.readFile('chores.json', 'utf8', (err, data) => {
        if (!err) {
            chores = JSON.parse(data);
        }
    });
}

// Write events to file
function saveChores() {
    let json_chores = JSON.stringify(chores, 2, null)
    fs.writeFileSync('chores.json', json_chores, (err) => {
        if (err) {
            console.error("Error saving chores:", err);
        }
    });
}

// Load data when server starts
loadEvents();
loadRooms();
loadChores();

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

// Add a new rooms
app.post('/rooms', (req, res) => {
    const newRoom = req.body;
    rooms.push(newRoom);
    saveRooms()
    res.status(201).send(newRoom);
});


// Get all chores
app.get('/chores', (req, res) => {
    res.send(chores);
});

// Add a new chores
app.post('/chores', (req, res) => {
    let newChore = req.body;
    newChore.repetition = newChore.nextTime;
    chores.push(newChore);
    saveChores()
    res.status(201).send(newChore);
});

// Start the server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
