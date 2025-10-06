// Script to clear old Sea Level data after schema change
// Run this with: node clear-sea-level-data.js

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://nqt230103a:123456789trungAa%2E@earch-pulse.wtyuu8h.mongodb.net/earth-pulse?retryWrites=true&w=majority&appName=Earch-Pulse';

async function clearSeaLevelData() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('earth-pulse');
    const collection = db.collection('sealevels');

    // Count documents before deletion
    const countBefore = await collection.countDocuments();
    console.log(`📊 Found ${countBefore} sea level documents`);

    if (countBefore > 0) {
      // Delete all documents
      const result = await collection.deleteMany({});
      console.log(`🗑️  Deleted ${result.deletedCount} sea level documents`);
      
      // Drop old indexes (will be recreated by Mongoose with new schema)
      await collection.dropIndexes();
      console.log('🔧 Dropped old indexes');
    } else {
      console.log('⚠️  No data to delete');
    }

    console.log('✅ Sea Level collection cleared successfully!');
    console.log('💡 New data will be collected on next cron run (every hour at :10)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

clearSeaLevelData();
