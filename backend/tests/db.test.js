const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { connectDatabase } = require('../src/db');

function recordingLogger() {
  const warnings = [];
  return { warnings, warn: (msg) => warnings.push(msg) };
}

describe('connectDatabase retry', () => {
  it('retries transient failures with backoff, then gives up', async () => {
    const logger = recordingLogger();
    await assert.rejects(
      connectDatabase({
        // Nothing listens on port 1, so every attempt fails server selection.
        uri: 'mongodb://127.0.0.1:1/?directConnection=true',
        dbName: 'retry_test',
        retries: 2,
        initialDelayMs: 10,
        serverSelectionTimeoutMS: 200,
        logger,
      }),
      /gave up after 3 attempts/,
    );
    assert.equal(logger.warnings.length, 2);
    assert.match(logger.warnings[0], /attempt 1\/3 failed/);
    assert.match(logger.warnings[1], /attempt 2\/3 failed/);
  });

  it('does not retry a malformed connection string', async () => {
    const logger = recordingLogger();
    await assert.rejects(
      connectDatabase({ uri: 'mongodb+srv://user:p@ss@cluster0.example.net', dbName: 'x', retries: 3, initialDelayMs: 10, logger }),
      (err) => err.name === 'MongoParseError' && !/p@ss/.test(err.message),
    );
    assert.equal(logger.warnings.length, 0);
  });

  it('fails fast without a URI', async () => {
    await assert.rejects(connectDatabase({ uri: '', dbName: 'x' }), /MONGODB_URI is not set/);
  });
});
