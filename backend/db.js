import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';

// Recursively strip keys that could be interpreted as MongoDB query/update
// operators ($-prefixed) or that allow dotted-path traversal. Protects every
// user-supplied object that reaches a query filter or a write payload from
// NoSQL operator injection (OWASP A03: Injection).
function sanitize(value) {
	if (Array.isArray(value)) {
		return value.map(sanitize);
	}
	if (value && typeof value === 'object' && !(value instanceof ObjectId) && !(value instanceof Date)) {
		const clean = {};
		for (const [key, val] of Object.entries(value)) {
			if (typeof key !== 'string') continue;
			if (key.startsWith('$') || key.includes('.')) continue;
			clean[key] = sanitize(val);
		}
		return clean;
	}
	return value;
}

class DB {
	constructor() {
		this.mongoUri = process.env.MONGO_URI || "mongodb://database:27017/db";
		this.db = null;
		this.secret = process.env.SECRET;
		if (!this.secret || this.secret.length < 32) {
			throw new Error('SECRET env var is missing or too weak (need >= 32 chars). Refusing to start.');
		}
	}

	async connectDB() {
		const client = new MongoClient(this.mongoUri);
		await client.connect();
		console.log("Connected to MongoDB");
		this.db = client.db();
	}

	// Returns the tenant session string on success, or null when the token is
	// absent/invalid/expired. Callers MUST treat null as "unauthorized" and
	// refuse the operation — never fall back to a shared/zero tenant.
	getSession(token) {
		if (!token || typeof token !== 'string') return null;
		try {
			const session = jwt.verify(token, this.secret).session;
			return (typeof session === 'string' && session.length > 0) ? session : null;
		} catch {
			return null;
		}
	}

	async insert(elem, collectionName, session) {
		try {
			const scope = this.getSession(session)
			if (!scope) return false
			const doc = { ...sanitize(elem), session: scope }
			const collection = this.db.collection(collectionName)
			await collection.insertOne(doc)
			console.log(`Document inserted in collection ${collectionName}.`);
		} catch (err) {
			console.error("Error inserting data in db:", err);
			return false
		}
		return true
	}

	async insertRespond(elem, collectionName, session, res) {
		try {
			const scope = this.getSession(session)
			if (!scope) {
				res.status(401).send({ error: "Unauthorized" });
				return
			}
			const doc = { ...sanitize(elem), session: scope }
			const collection = this.db.collection(collectionName)
			const result = await collection.insertOne(doc)
			console.log(`Document inserted in collection ${collectionName}.`);
			res.status(201).send({ acknowledged: result.acknowledged, insertedId: result.insertedId });
		} catch (err) {
			console.error("Error inserting data in db:", err);
			res.status(500).send({ error: "Internal server error" });
		}
	}

	async insertMany(elem, collectionName, session, res) {
		try {
			const scope = this.getSession(session)
			if (!scope) {
				res.status(401).send({ error: "Unauthorized" });
				return
			}
			const docs = elem.map((el) => ({ ...sanitize(el), session: scope }))
			const collection = this.db.collection(collectionName)
			const result = await collection.insertMany(docs)
			console.log(`${result.insertedCount} ${collectionName} inserted in db.`);
			res.status(201).send({ acknowledged: result.acknowledged, insertedCount: result.insertedCount, insertedIds: result.insertedIds });
		} catch (err) {
			console.error("Error inserting data in db:", err);
			res.status(500).send({ error: "Internal server error" });
		}
	}

	async findRespond(collectionName, session, res, where = {}) {
		try {
			const scope = this.getSession(session)
			if (!scope) {
				res.status(401).send({ error: "Unauthorized" });
				return
			}
			where = { ...sanitize(where), session: scope }
			const collection = this.db.collection(collectionName)
			const document = await collection.find(where).toArray();
			console.log(`${document.length} document retrieved from ${collectionName} from db.`);
			res.send(document);
		} catch (err) {
			console.error("Error retrieving data from db:", err);
			res.status(500).send({ error: "Internal server error" });
		}
	}

	async findLogin(username) {
		try {
			const collection = this.db.collection('sessions')
			const document = await collection.find({ "username": String(username) }).toArray();
			return document;
		} catch (err) {
			console.error("Error retrieving data from db:", err);
			return false;
		}
	}

	async findVerify(session) {
		try {
			const collection = this.db.collection('sessions')
			const document = await collection.find({ "session": session }).toArray();
			return document;
		} catch (err) {
			console.error("Error retrieving data from db:", err);
			return false;
		}
	}

	// Sessions are the tenancy roots, so registration/lookup against the
	// `sessions` collection cannot be tenant-scoped. Username is coerced to a
	// string so a JSON object (e.g. {$ne:null}) can never become a query operator.
	async findSessionByUsername(username) {
		try {
			const collection = this.db.collection('sessions')
			return await collection.find({ "username": String(username) }).toArray();
		} catch (err) {
			console.error("Error retrieving data from db:", err);
			return false;
		}
	}

	async insertSession(doc) {
		try {
			const collection = this.db.collection('sessions')
			const result = await collection.insertOne(sanitize(doc))
			return result.acknowledged;
		} catch (err) {
			console.error("Error creating session:", err);
			return false;
		}
	}

	// A household's new password hash, and when it changed (seconds): /verify
	// refuses the logins issued before then.
	async setSessionPassword(session, password, changedAt) {
		try {
			const collection = this.db.collection('sessions')
			const result = await collection.updateOne(
				{ "session": String(session) },
				{ $set: { password: String(password), passwordChangedAt: Number(changedAt) } }
			);
			return result.matchedCount === 1;
		} catch (err) {
			console.error("Error changing password:", err);
			return false;
		}
	}

	async find(collectionName, session, where = {}) {
		try {
			const scope = this.getSession(session)
			if (!scope) return false;
			where = { ...sanitize(where), session: scope }
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
			const scope = this.getSession(session)
			if (!scope) {
				res.status(401).send({ error: "Unauthorized" });
				return
			}
			if (!where || Object.keys(where).length === 0) {
				res.status(400).send({ error: 'Cannot delete without a filter' });
				return
			}
			where = { ...sanitize(where), session: scope }
			const result = await this.db.collection(collectionName).deleteOne(where);

			if (result.deletedCount === 0) {
				return res.status(404).send({ error: 'No matching element found' });
			}
			console.log('Deleted ', result.deletedCount, ' from ', collectionName)
			res.status(200).send({ message: 'Deleted successfully' });
		} catch (error) {
			console.error('Error deleting data from db:', error);
			res.status(500).send({ message: 'Error deleting data from db' });
		}
	}

	async delete(collectionName, session, where) {
		try {
			const scope = this.getSession(session)
			if (!scope) return false;
			if (!where || Object.keys(where).length === 0) return false;
			where = { ...sanitize(where), session: scope }
			const result = await this.db.collection(collectionName).deleteOne(where);

			console.log('Deleted ', result.deletedCount, ' from ', collectionName)
			return result.deletedCount !== 0;
		} catch (error) {
			console.error('Error deleting data from db:', error);
			return false;
		}
	}

	async updateRespond(collectionName, session, res, where, updated_data) {
		try {
			const scope = this.getSession(session)
			if (!scope) {
				res.status(401).send({ error: "Unauthorized" });
				return
			}
			if (!where || Object.keys(where).length === 0) {
				res.status(400).send({ message: 'Cannot update without a filter' });
				return
			}
			where = { ...sanitize(where), session: scope }
			const result = await this.db.collection(collectionName).updateOne(where, this.sanitizeUpdate(updated_data));

			if (result.matchedCount === 0) {
				return res.status(404).send({ error: 'No matching element found' });
			}
			res.status(200).send({ message: 'Updated successfully' });
		} catch (error) {
			console.error('Error updating data from db:', error);
			res.status(500).send({ message: 'Error updating data from db' });
		}
	}

	async update(collectionName, session, where, updated_data) {
		try {
			const scope = this.getSession(session)
			if (!scope) return false
			if (!where || Object.keys(where).length === 0) return false
			where = { ...sanitize(where), session: scope }
			const result = await this.db.collection(collectionName).updateOne(where, this.sanitizeUpdate(updated_data));
			if (!result.matchedCount)
				return false
		} catch (error) {
			console.error('Error updating data from db:', error);
			return false
		}
		return true
	}

	// Update payloads use top-level operators ($set/$inc/...), so we keep those
	// but sanitize the *values* being written to block nested operator/dotted
	// injection and to forbid clients from reassigning the tenancy field.
	sanitizeUpdate(update) {
		if (!update || typeof update !== 'object') return {};
		const clean = {};
		for (const [op, payload] of Object.entries(update)) {
			if (!op.startsWith('$')) continue;
			const cleanPayload = sanitize(payload);
			delete cleanPayload.session;
			delete cleanPayload._id;
			clean[op] = cleanPayload;
		}
		return clean;
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

const db = new DB();
export default db;
export { ObjectId, sanitize };
