import schedule from 'node-schedule';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import https from 'https';
import cookies from 'cookie-parser';
import db from './db.js';
import authRouter from './auth.js';
import eventsRouter from './events.js';
import todosRouter from './todos.js';
import tagsRouter from './tags.js';
import roomsRouter from './rooms.js';
import choresRouter from './chores.js';
import usersRouter from './users.js';
import assistantRouter, { initAssistant } from './assistant.js';
import automationsRouter, { startScheduler, initAutomations } from './automations.js';
import { securityHeaders, mongoSanitize } from './security.js';

const app = express();
const PORT = 3000;

await db.connectDB();

// The assistant queue must be ready (and recovered) before the scheduler
// looks at automations left "running" by a restart.
const assistantQueue = await initAssistant(db.db);
initAutomations(assistantQueue);

// Backend is only reached server-side by the SvelteKit frontend over the
// internal Docker network; lock CORS to that origin and don't leak the stack.
app.disable('x-powered-by');
app.set('trust proxy', false);
app.use(cors({
	origin: 'https://frontend:5173',
	credentials: true,
}));
app.use(securityHeaders);
app.use(express.json({ limit: '256kb' }));
app.use(cookies());
app.use(mongoSanitize);

schedule.scheduleJob('0 0 * * *', () => db.scheduledUpdate());
// Recovery first: a requeued automation must not also be marked interrupted
await startScheduler();
assistantQueue.start();

app.use('/', authRouter);
app.use('/', eventsRouter);
app.use('/', todosRouter);
app.use('/', tagsRouter);
app.use('/', roomsRouter);
app.use('/', choresRouter);
app.use('/', usersRouter);
app.use('/', assistantRouter);
app.use('/', automationsRouter);

const sslOptions = {
	key: fs.readFileSync('keys/private.key'),
	cert: fs.readFileSync('keys/certificate.crt'),
	ca: fs.readFileSync('keys/ca_bundle.crt'),
};

https.createServer(sslOptions, app).listen(PORT, () => {
	console.log(`Server running on https://localhost:${PORT}`);
});
