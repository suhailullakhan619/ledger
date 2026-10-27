const mongoose = require('mongoose');
const { MODELS } = require('./models');

mongoose.set('strictQuery', true);
// Collections and indexes are created explicitly in prepareCollections().
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);

const NAMESPACE_EXISTS = 48;

async function applyValidator(connection, name, validator) {
  try {
    await connection.db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
  } catch (err) {
    // collMod needs dbAdmin rights; a plain readWrite user can still run the app.
    console.warn(`Could not update validator on '${name}': ${err.message}`);
  }
}

/**
 * Create collections with a MongoDB $jsonSchema validator and build all indexes
 * (including the unique ones the business rules depend on). Collections must
 * exist before they are written inside a multi-document transaction.
 */
async function prepareCollections(connection) {
  const existing = new Set((await connection.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const { model, validator } of MODELS) {
    const name = model.collection.collectionName;
    if (existing.has(name)) {
      await applyValidator(connection, name, validator);
    } else {
      try {
        await connection.db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
      } catch (err) {
        if (err.code !== NAMESPACE_EXISTS) throw err;
        await applyValidator(connection, name, validator);
      }
    }
    await model.syncIndexes();
  }
}

const AUTH_FAILED_CODES = new Set([18, 8000]); // AuthenticationFailed / Atlas "bad auth"

/** Errors that will fail identically on every attempt, so retrying only delays the inevitable. */
function isPermanentConnectError(err) {
  return (
    err.name === 'MongoParseError' ||
    AUTH_FAILED_CODES.has(err.code) ||
    /authentication failed|bad auth/i.test(err.message ?? '')
  );
}

const maskCredentials = (text) => String(text).replace(/\/\/[^@/\s]*@/g, '//***@');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Exponential backoff with jitter: ~initial, 2x, 4x ... capped at max. */
function backoffDelay(attempt, initialDelayMs, maxDelayMs) {
  const base = Math.min(maxDelayMs, initialDelayMs * 2 ** (attempt - 1));
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

/**
 * Connect and prepare collections, retrying transient failures (DNS hiccups,
 * dropped TLS connections, server selection timeouts) with exponential backoff.
 * Bad connection strings and authentication failures are not retried.
 */
async function connectDatabase({
  uri,
  dbName,
  retries = 5,
  initialDelayMs = 1000,
  maxDelayMs = 15000,
  serverSelectionTimeoutMS = 10000,
  logger = console,
}) {
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add your MongoDB connection string to backend/.env (see backend/.env.example).',
    );
  }

  const attempts = retries + 1;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS });
      await prepareCollections(mongoose.connection);
      return mongoose.connection;
    } catch (err) {
      await mongoose.disconnect().catch(() => {});
      err.message = maskCredentials(err.message);

      if (isPermanentConnectError(err) || attempt >= attempts) {
        if (attempt > 1) err.message = `${err.message} (gave up after ${attempt} attempts)`;
        throw err;
      }

      const delay = backoffDelay(attempt, initialDelayMs, maxDelayMs);
      logger.warn(`MongoDB connection attempt ${attempt}/${attempts} failed: ${err.message}. Retrying in ${delay} ms...`);
      await sleep(delay);
    }
  }
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

/**
 * Run `fn(session)` inside a multi-document transaction. Every write made with the
 * session commits together or not at all. Transient errors (e.g. write conflicts
 * from concurrent requests on the same account) are retried by the driver; any
 * other thrown error aborts the transaction and is re-thrown.
 */
async function runInTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { connectDatabase, disconnectDatabase, runInTransaction, prepareCollections };
