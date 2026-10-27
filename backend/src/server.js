const config = require('./config');
const { createApp } = require('./app');
const { connectDatabase, disconnectDatabase } = require('./db');

async function main() {
  await connectDatabase(config.mongo);
  console.log(`Connected to MongoDB database '${config.mongo.dbName}'`);

  const server = createApp().listen(config.port, () => {
    console.log(`Transaction Ledger API listening on http://localhost:${config.port}`);
  });

  const shutdown = () => {
    server.close(async () => {
      await disconnectDatabase();
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
