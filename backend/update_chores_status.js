// This script adds status: 0 to all documents in the chores collection
import { MongoClient } from 'mongodb';

async function updateChoresStatus() {
  // Use the same MongoDB URI as in the main application
  const mongoUri = process.env.MONGO_URI || "mongodb://database:27017/db";
  
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log("Connected to MongoDB");
    
    const db = client.db();
    const choresCollection = db.collection('chores');
    
    // Find all documents in the chores collection
    const chores = await choresCollection.find({}).toArray();
    console.log(`Found ${chores.length} documents in the chores collection`);
    
    // Update all documents that don't already have a status field
    const result = await choresCollection.updateMany(
      { status: { $exists: false } },
      { $set: { status: 0 } }
    );
    
    console.log(`Updated ${result.modifiedCount} out of ${result.matchedCount} documents`);
    
    // Close the connection
    await client.close();
    console.log("Connection closed");
  } catch (err) {
    console.error("Error updating chores status:", err);
  }
}

// Run the function
updateChoresStatus();
