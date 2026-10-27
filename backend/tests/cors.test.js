const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');

async function allowed(app, origin) {
  const res = await request(app).get('/api/nope').set('Origin', origin);
  return res.headers['access-control-allow-origin'] === origin;
}

describe('CORS_ORIGIN', () => {
  it('allows listed origins and wildcard entries only', async () => {
    const app = createApp({ corsOrigin: 'https://ledger.vercel.app, https://ledger-*.vercel.app, http://localhost:5173/' });
    assert.equal(await allowed(app, 'https://ledger.vercel.app'), true);
    assert.equal(await allowed(app, 'https://ledger-git-main-team.vercel.app'), true);
    assert.equal(await allowed(app, 'http://localhost:5173'), true);
    assert.equal(await allowed(app, 'https://other.vercel.app'), false);
    assert.equal(await allowed(app, 'https://ledger-x.vercel.app.evil.com'), false);
  });

  it('allows any origin with a bare *', async () => {
    const app = createApp({ corsOrigin: '*' });
    assert.equal(await allowed(app, 'https://anything.example.com'), true);
  });
});
