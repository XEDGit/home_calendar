import { ObjectId } from './db.js';

// Returns a valid ObjectId built from req.body.id, or false after sending a
// 400. Never throws on attacker-controlled input (an invalid id string or a
// non-string would otherwise raise a BSONError and surface a 500/stack).
export function getID(req, res) {
	const id = req.body?.id;
	if (typeof id !== 'string' || !ObjectId.isValid(id)) {
		res.status(400).send({ error: "Missing or invalid id field" });
		return false;
	}
	return new ObjectId(id);
}

// Safe ObjectId conversion without a response side-effect. Returns null on
// invalid input.
export function toObjectId(value) {
	if (typeof value !== 'string' || !ObjectId.isValid(value)) return null;
	return new ObjectId(value);
}

export function getCookie(cookieString, name) {
	if (typeof cookieString !== 'string') return null;
	const cookieArr = cookieString.split(';');
	for (let i = 0; i < cookieArr.length; i++) {
		let cookie = cookieArr[i].trim();
		if (cookie.startsWith(name + '=')) {
			return cookie.substring(name.length + 1, cookie.length);
		}
	}
	return null;
}
