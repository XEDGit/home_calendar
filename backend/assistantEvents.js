import { EventEmitter } from 'node:events';

// In-process events for the assistant, per member: the worker publishes
// queue positions and streaming output, each open /assistant/events stream
// subscribes to its own member only.
const bus = new EventEmitter();
bus.setMaxListeners(0);

const key = (session, user) => `${session}:${user}`;

export function publish(session, user, event) {
	bus.emit(key(session, user), event);
}

export function subscribe(session, user, fn) {
	const k = key(session, user);
	bus.on(k, fn);
	return () => bus.off(k, fn);
}

export function listenerTotal() {
	return bus.eventNames().reduce((n, name) => n + bus.listenerCount(name), 0);
}
