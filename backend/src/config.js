require('dotenv').config({ quiet: true });

module.exports = {
  port: Number(process.env.PORT) || 3000,
  mongo: {
    // MongoDB connection string, e.g. mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net
    // Must point at a replica set (every Atlas cluster is one): multi-document
    // transactions are used to keep balances and transactions consistent.
    uri: process.env.MONGODB_URI || '',
    dbName: process.env.MONGODB_DB_NAME || 'ledger',
    // Startup connection retries (exponential backoff). Auth / malformed-URI errors are never retried.
    retries: process.env.MONGODB_CONNECT_RETRIES !== undefined ? Number(process.env.MONGODB_CONNECT_RETRIES) : 5,
    initialDelayMs: Number(process.env.MONGODB_RETRY_DELAY_MS) || 1000,
    maxDelayMs: 15000,
  },
  // Comma-separated list of allowed browser origins, or "*" for any.
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  pagination: {
    defaultPage: 1,
    defaultLimit: 10,
    maxLimit: 100,
  },
};
