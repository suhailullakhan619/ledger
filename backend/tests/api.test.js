const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { connectDatabase, disconnectDatabase } = require('../src/db');
const { Account, Transaction } = require('../src/models');

// A replica set is required for multi-document transactions.
let replSet;
let app;
let db;
const MISSING_ID = new mongoose.Types.ObjectId().toString();

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await connectDatabase({ uri: replSet.getUri(), dbName: 'ledger_test' });
  db = mongoose.connection.db;
  app = createApp();
});

after(async () => {
  await disconnectDatabase();
  await replSet.stop();
});

beforeEach(async () => {
  // Raw driver deletes bypass the immutability hooks on the models.
  await Promise.all(['accounts', 'transactions', 'transfers'].map((c) => db.collection(c).deleteMany({})));
});

const count = (collection) => db.collection(collection).countDocuments();

async function createAccount(name = 'Alice') {
  const res = await request(app).post('/api/accounts').send({ name });
  assert.equal(res.status, 201);
  return res.body.data;
}

function addTxn(accountId, body) {
  return request(app).post(`/api/accounts/${accountId}/transactions`).send(body);
}

async function balanceOf(accountId) {
  const res = await request(app).get(`/api/accounts/${accountId}/balance`);
  return res.body.data.balance;
}

describe('Create account', () => {
  it('creates an account with zero balance and system-generated fields', async () => {
    const res = await request(app).post('/api/accounts').send({ name: '  Alice  ' });
    assert.equal(res.status, 201);
    const acc = res.body.data;
    assert.match(acc.id, /^[0-9a-f]{24}$/);
    assert.equal(acc.name, 'Alice');
    assert.equal(acc.balance, 0);
    assert.ok(!Number.isNaN(Date.parse(acc.created_at)));
  });

  it('generates unique ids', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    assert.notEqual(a.id, b.id);
  });

  it('requires a name', async () => {
    for (const body of [{}, { name: '' }, { name: '   ' }, { name: 123 }]) {
      const res = await request(app).post('/api/accounts').send(body);
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });

  it('rejects a client-supplied balance, id or created_at', async () => {
    for (const extra of [{ balance: 500 }, { id: 'x' }, { created_at: '2020-01-01' }]) {
      const res = await request(app).post('/api/accounts').send({ name: 'Bob', ...extra });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
    assert.equal(await count('accounts'), 0);
  });

  it('rejects malformed JSON and non-object bodies', async () => {
    let res = await request(app).post('/api/accounts').set('Content-Type', 'application/json').send('{"name":');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_JSON');

    res = await request(app).post('/api/accounts').send([{ name: 'x' }]);
    assert.equal(res.status, 400);

    res = await request(app).post('/api/accounts');
    assert.equal(res.status, 400);
  });
});

describe('Get balance', () => {
  it('returns account_id and balance', async () => {
    const acc = await createAccount();
    const res = await request(app).get(`/api/accounts/${acc.id}/balance`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { account_id: acc.id, balance: 0 });
  });

  it('returns 404 for an unknown account', async () => {
    const res = await request(app).get(`/api/accounts/${MISSING_ID}/balance`);
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ACCOUNT_NOT_FOUND');
  });

  it('returns 400 for a malformed account id', async () => {
    const res = await request(app).get('/api/accounts/does-not-exist/balance');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });
});

describe('Add transaction', () => {
  it('credit increases and debit decreases the balance', async () => {
    const acc = await createAccount();
    let res = await addTxn(acc.id, { type: 'credit', amount: 100, reference_id: 'r1', description: 'Salary' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.type, 'credit');
    assert.equal(res.body.data.amount, 100);
    assert.equal(res.body.data.account_id, acc.id);
    assert.equal(res.body.data.description, 'Salary');
    assert.equal(res.body.meta.balance, 100);

    res = await addTxn(acc.id, { type: 'credit', amount: 50, reference_id: 'r2' });
    assert.equal(res.body.meta.balance, 150);

    res = await addTxn(acc.id, { type: 'debit', amount: 30, reference_id: 'r3' });
    assert.equal(res.status, 201);
    assert.equal(res.body.meta.balance, 120);
  });

  it('rejects a debit larger than the balance and leaves balance unchanged', async () => {
    const acc = await createAccount();
    await addTxn(acc.id, { type: 'credit', amount: 100, reference_id: 'c1' });

    const res = await addTxn(acc.id, { type: 'debit', amount: 150, reference_id: 'd1' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'INSUFFICIENT_BALANCE');
    assert.equal(await balanceOf(acc.id), 100);

    const history = await request(app).get(`/api/accounts/${acc.id}/transactions`);
    assert.equal(history.body.pagination.total_records, 1);

    // The rejected reference_id was not consumed and can be retried.
    const retry = await addTxn(acc.id, { type: 'debit', amount: 100, reference_id: 'd1' });
    assert.equal(retry.status, 201);
    assert.equal(await balanceOf(acc.id), 0);
  });

  it('allows a debit of exactly the full balance', async () => {
    const acc = await createAccount();
    await addTxn(acc.id, { type: 'credit', amount: 10.5, reference_id: 'c1' });
    const res = await addTxn(acc.id, { type: 'debit', amount: 10.5, reference_id: 'd1' });
    assert.equal(res.status, 201);
    assert.equal(res.body.meta.balance, 0);
  });

  it('handles decimal amounts without float drift', async () => {
    const acc = await createAccount();
    await addTxn(acc.id, { type: 'credit', amount: 0.1, reference_id: 'a' });
    await addTxn(acc.id, { type: 'credit', amount: 0.2, reference_id: 'b' });
    assert.equal(await balanceOf(acc.id), 0.3);
  });

  it('rejects duplicate reference_id for the same account without changing balance', async () => {
    const acc = await createAccount();
    const first = await addTxn(acc.id, { type: 'credit', amount: 100, reference_id: 'dup' });
    assert.equal(first.status, 201);

    const dup = await addTxn(acc.id, { type: 'credit', amount: 100, reference_id: 'dup' });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'DUPLICATE_TRANSACTION');
    assert.equal(dup.body.error.details.existing_transaction.id, first.body.data.id);
    assert.equal(await balanceOf(acc.id), 100);
    assert.equal(await count('transactions'), 1);
  });

  it('allows the same reference_id on different accounts', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    assert.equal((await addTxn(a.id, { type: 'credit', amount: 5, reference_id: 'same' })).status, 201);
    assert.equal((await addTxn(b.id, { type: 'credit', amount: 5, reference_id: 'same' })).status, 201);
  });

  it('returns 404 for an unknown account', async () => {
    const res = await addTxn(MISSING_ID, { type: 'credit', amount: 5, reference_id: 'x' });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ACCOUNT_NOT_FOUND');
  });

  it('validates type, amount and reference_id', async () => {
    const acc = await createAccount();
    const cases = [
      { type: 'refund', amount: 5, reference_id: 'x' },
      { amount: 5, reference_id: 'x' },
      { type: 'credit', amount: 0, reference_id: 'x' },
      { type: 'credit', amount: -5, reference_id: 'x' },
      { type: 'credit', amount: '5', reference_id: 'x' },
      { type: 'credit', amount: 1.234, reference_id: 'x' },
      { type: 'credit', reference_id: 'x' },
      { type: 'credit', amount: 5 },
      { type: 'credit', amount: 5, reference_id: '  ' },
      { type: 'credit', amount: 5, reference_id: 'x', balance: 1 },
    ];
    for (const body of cases) {
      const res = await addTxn(acc.id, body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(res.body.error.details));
    }
    assert.equal(await balanceOf(acc.id), 0);
  });
});

describe('Transaction history', () => {
  async function seed() {
    const acc = await createAccount();
    // 3 credits, 2 debits
    await addTxn(acc.id, { type: 'credit', amount: 100, reference_id: 't1' });
    await addTxn(acc.id, { type: 'credit', amount: 50, reference_id: 't2' });
    await addTxn(acc.id, { type: 'debit', amount: 30, reference_id: 't3' });
    await addTxn(acc.id, { type: 'debit', amount: 20, reference_id: 't4' });
    await addTxn(acc.id, { type: 'credit', amount: 1, reference_id: 't5' });
    return acc;
  }

  it('returns all transactions latest-first with pagination metadata', async () => {
    const acc = await seed();
    const res = await request(app).get(`/api/accounts/${acc.id}/transactions`);
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.map((t) => t.reference_id),
      ['t5', 't4', 't3', 't2', 't1'],
    );
    assert.deepEqual(res.body.pagination, {
      page: 1,
      limit: 10,
      total_records: 5,
      total_pages: 1,
      has_next_page: false,
      has_previous_page: false,
    });
  });

  it('filters by type', async () => {
    const acc = await seed();
    const credits = await request(app).get(`/api/accounts/${acc.id}/transactions?type=credit`);
    assert.deepEqual(credits.body.data.map((t) => t.reference_id), ['t5', 't2', 't1']);
    assert.equal(credits.body.pagination.total_records, 3);

    const debits = await request(app).get(`/api/accounts/${acc.id}/transactions?type=debit`);
    assert.deepEqual(debits.body.data.map((t) => t.reference_id), ['t4', 't3']);
  });

  it('paginates', async () => {
    const acc = await seed();
    const p1 = await request(app).get(`/api/accounts/${acc.id}/transactions?page=1&limit=2`);
    assert.deepEqual(p1.body.data.map((t) => t.reference_id), ['t5', 't4']);
    assert.equal(p1.body.pagination.total_pages, 3);
    assert.equal(p1.body.pagination.has_next_page, true);

    const p3 = await request(app).get(`/api/accounts/${acc.id}/transactions?page=3&limit=2`);
    assert.deepEqual(p3.body.data.map((t) => t.reference_id), ['t1']);
    assert.equal(p3.body.pagination.has_next_page, false);

    const beyond = await request(app).get(`/api/accounts/${acc.id}/transactions?page=9&limit=2`);
    assert.equal(beyond.status, 200);
    assert.deepEqual(beyond.body.data, []);
  });

  it('rejects invalid pagination and filter parameters', async () => {
    const acc = await createAccount();
    for (const qs of ['page=0', 'page=-1', 'page=abc', 'limit=0', 'limit=101', 'limit=2.5', 'type=refund']) {
      const res = await request(app).get(`/api/accounts/${acc.id}/transactions?${qs}`);
      assert.equal(res.status, 400, qs);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });

  it('returns 404 for an unknown account', async () => {
    const res = await request(app).get(`/api/accounts/${MISSING_ID}/transactions`);
    assert.equal(res.status, 404);
  });
});

describe('Data integrity', () => {
  it('balance equals the sum of all valid transactions', async () => {
    const acc = await createAccount();
    await addTxn(acc.id, { type: 'credit', amount: 100, reference_id: '1' });
    await addTxn(acc.id, { type: 'credit', amount: 50, reference_id: '2' });
    await addTxn(acc.id, { type: 'debit', amount: 30, reference_id: '3' });
    await addTxn(acc.id, { type: 'debit', amount: 500, reference_id: '4' }); // rejected
    await addTxn(acc.id, { type: 'debit', amount: 20, reference_id: '5' });
    await addTxn(acc.id, { type: 'credit', amount: 100, reference_id: '1' }); // duplicate
    assert.equal(await balanceOf(acc.id), 100);
  });

  it('transactions cannot be updated or deleted through the API', async () => {
    const acc = await createAccount();
    const created = await addTxn(acc.id, { type: 'credit', amount: 10, reference_id: 'x' });
    const txnUrl = `/api/accounts/${acc.id}/transactions/${created.body.data.id}`;

    for (const method of ['put', 'patch', 'delete']) {
      const res = await request(app)[method](txnUrl).send({ amount: 999 });
      assert.equal(res.status, 405);
      assert.equal(res.body.error.code, 'METHOD_NOT_ALLOWED');
    }
    const del = await request(app).delete(`/api/accounts/${acc.id}/transactions`);
    assert.equal(del.status, 405);

    const fetched = await request(app).get(txnUrl);
    assert.deepEqual(fetched.body.data, created.body.data);
  });

  it('transactions cannot be updated or deleted through the models', async () => {
    const acc = await createAccount();
    const created = await addTxn(acc.id, { type: 'credit', amount: 10, reference_id: 'x' });
    const id = created.body.data.id;

    await assert.rejects(Transaction.updateOne({ _id: id }, { amount: 5 }), /immutable/);
    await assert.rejects(Transaction.findOneAndUpdate({ _id: id }, { amount: 5 }), /immutable/);
    await assert.rejects(Transaction.deleteOne({ _id: id }), /immutable/);
    await assert.rejects(Transaction.deleteMany({}), /immutable/);
    const doc = await Transaction.findById(id);
    doc.description = 'changed';
    await assert.rejects(doc.save(), /immutable/);
    assert.equal(await count('transactions'), 1);
  });

  it('database validators reject negative balance and invalid rows', async () => {
    const acc = await createAccount();
    await assert.rejects(
      db.collection('accounts').updateOne({ _id: new mongoose.Types.ObjectId(acc.id) }, { $set: { balance: -1 } }),
      /validation/i,
    );
    await assert.rejects(
      db.collection('transactions').insertOne({
        account_id: new mongoose.Types.ObjectId(acc.id),
        type: 'refund',
        amount: 1,
        reference_id: 'r',
        created_at: new Date(),
      }),
      /validation/i,
    );
    await assert.rejects(Account.updateOne({ _id: acc.id }, { $set: { balance: -1 } }, { runValidators: true }));
  });

  it('handles concurrent debits without overdrawing', async () => {
    const acc = await createAccount();
    await addTxn(acc.id, { type: 'credit', amount: 100, reference_id: 'seed' });

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => addTxn(acc.id, { type: 'debit', amount: 30, reference_id: `d${i}` })),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 3);
    assert.ok(results.every((r) => r.status === 201 || r.status === 422));
    assert.equal(await balanceOf(acc.id), 10);
  });

  it('handles concurrent duplicate reference_ids', async () => {
    const acc = await createAccount();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => addTxn(acc.id, { type: 'credit', amount: 10, reference_id: 'same' })),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 4);
    assert.equal(await balanceOf(acc.id), 10);
  });
});

describe('Transfers', () => {
  function transfer(body) {
    return request(app).post('/api/transfers').send(body);
  }

  it('moves money atomically between accounts', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    await addTxn(a.id, { type: 'credit', amount: 100, reference_id: 'seed' });
    await addTxn(b.id, { type: 'credit', amount: 50, reference_id: 'seed' });

    const res = await transfer({ from_account_id: a.id, to_account_id: b.id, amount: 30, reference_id: 'tr1' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.balances.from_account.balance, 70);
    assert.equal(res.body.data.balances.to_account.balance, 80);
    assert.equal(res.body.data.transactions.debit.transfer_id, res.body.data.transfer.id);
    assert.equal(await balanceOf(a.id), 70);
    assert.equal(await balanceOf(b.id), 80);

    const bHistory = await request(app).get(`/api/accounts/${b.id}/transactions?type=credit`);
    assert.equal(bHistory.body.data[0].reference_id, 'tr1');
  });

  it('rolls back completely on insufficient balance', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    await addTxn(a.id, { type: 'credit', amount: 10, reference_id: 'seed' });

    const res = await transfer({ from_account_id: a.id, to_account_id: b.id, amount: 30, reference_id: 'tr1' });
    assert.equal(res.status, 422);
    assert.equal(await balanceOf(a.id), 10);
    assert.equal(await balanceOf(b.id), 0);
    assert.equal(await count('transfers'), 0);
  });

  it('rolls back the debit when the credit leg fails', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    await addTxn(a.id, { type: 'credit', amount: 100, reference_id: 'seed' });
    // Destination already used this reference_id, so the credit leg will fail after the debit.
    await addTxn(b.id, { type: 'credit', amount: 1, reference_id: 'clash' });

    const res = await transfer({ from_account_id: a.id, to_account_id: b.id, amount: 30, reference_id: 'clash' });
    assert.equal(res.status, 409);
    assert.equal(await balanceOf(a.id), 100);
    assert.equal(await balanceOf(b.id), 1);
    assert.equal(await count('transfers'), 0);
  });

  it('rejects unknown accounts, same account and duplicate transfers', async () => {
    const a = await createAccount('A');
    const b = await createAccount('B');
    await addTxn(a.id, { type: 'credit', amount: 100, reference_id: 'seed' });

    let res = await transfer({ from_account_id: a.id, to_account_id: MISSING_ID, amount: 1, reference_id: 'x' });
    assert.equal(res.status, 404);
    res = await transfer({ from_account_id: MISSING_ID, to_account_id: a.id, amount: 1, reference_id: 'x' });
    assert.equal(res.status, 404);
    res = await transfer({ from_account_id: 'nope', to_account_id: a.id, amount: 1, reference_id: 'x' });
    assert.equal(res.status, 400);
    res = await transfer({ from_account_id: a.id, to_account_id: a.id, amount: 1, reference_id: 'x' });
    assert.equal(res.status, 400);
    assert.equal(await balanceOf(a.id), 100);

    res = await transfer({ from_account_id: a.id, to_account_id: b.id, amount: 10, reference_id: 'once' });
    assert.equal(res.status, 201);
    res = await transfer({ from_account_id: a.id, to_account_id: b.id, amount: 10, reference_id: 'once' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'DUPLICATE_TRANSACTION');
    assert.equal(await balanceOf(a.id), 90);
    assert.equal(await balanceOf(b.id), 10);
  });
});

describe('Account list and stats', () => {
  it('lists accounts latest first with pagination', async () => {
    await createAccount('A');
    await createAccount('B');
    await createAccount('C');
    const res = await request(app).get('/api/accounts?limit=2');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.map((a) => a.name), ['C', 'B']);
    assert.equal(res.body.pagination.total_records, 3);
    assert.equal(res.body.pagination.total_pages, 2);
  });

  it('returns dashboard stats', async () => {
    const a = await createAccount('A');
    await addTxn(a.id, { type: 'credit', amount: 100, reference_id: '1' });
    await addTxn(a.id, { type: 'debit', amount: 40, reference_id: '2' });
    const res = await request(app).get('/api/stats');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.total_accounts, 1);
    assert.equal(res.body.data.total_balance, 60);
    assert.equal(res.body.data.transactions.credit_volume, 100);
    assert.equal(res.body.data.transactions.debit_count, 1);
    assert.equal(res.body.data.recent_transactions[0].reference_id, '2');
  });
});

describe('Unknown routes', () => {
  it('returns a consistent 404', async () => {
    const res = await request(app).get('/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
  });
});
