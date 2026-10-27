// Run the API against a throwaway in-memory MongoDB replica set.
// Useful for trying the app before MONGODB_URI is configured. All data is lost on exit.
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const config = require('../src/config');
const { createApp } = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/db');

async function main() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await connectDatabase({ uri: replSet.getUri(), dbName: config.mongo.dbName });
  console.log('Connected to in-memory MongoDB replica set (data is NOT persisted)');

  const server = createApp().listen(config.port, () => {
    console.log(`Transaction Ledger API listening on http://localhost:${config.port}`);
  });

  const shutdown = () => {
    server.close(async () => {
      await disconnectDatabase();
      await replSet.stop();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
