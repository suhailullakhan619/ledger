const express = require('express');
const { validate } = require('../middleware/validate');
const { validateObjectIdParam } = require('../middleware/validateObjectId');
const { MethodNotAllowedError } = require('../errors');
const {
  createAccountBody,
  createTransactionBody,
  listAccountsQuery,
  listTransactionsQuery,
} = require('../validators/schemas');
const accountService = require('../services/accountService');
const transactionService = require('../services/transactionService');

const router = express.Router();

router.param('accountId', validateObjectIdParam);
router.param('transactionId', validateObjectIdParam);

// 1. Create account
router.post('/', validate(createAccountBody), async (req, res) => {
  const account = await accountService.createAccount(req.validated.body);
  res.status(201).location(`${req.baseUrl}/${account.id}`).json({ data: account });
});

// List accounts (latest first, paginated)
router.get('/', validate(listAccountsQuery, 'query'), async (req, res) => {
  res.json(await accountService.listAccounts(req.validated.query));
});

// Account details
router.get('/:accountId', async (req, res) => {
  res.json({ data: await accountService.getAccount(req.params.accountId) });
});

// 3. Get account balance
router.get('/:accountId/balance', async (req, res) => {
  res.json({ data: await accountService.getBalance(req.params.accountId) });
});

// 2. Add transaction
router.post('/:accountId/transactions', validate(createTransactionBody), async (req, res) => {
  const result = await transactionService.createTransaction(req.params.accountId, req.validated.body);
  res.status(201).json({ data: result.transaction, meta: { balance: result.balance } });
});

// 4. Transaction history (filter by type, paginate, latest first)
router.get('/:accountId/transactions', validate(listTransactionsQuery, 'query'), async (req, res) => {
  res.json(await transactionService.listTransactions(req.params.accountId, req.validated.query));
});

router.get('/:accountId/transactions/:transactionId', async (req, res) => {
  res.json({ data: await transactionService.getTransaction(req.params.accountId, req.params.transactionId) });
});

// Transactions are immutable: explicitly reject any attempt to edit or delete them.
router.all(['/:accountId/transactions', '/:accountId/transactions/:transactionId'], (req, res, next) => {
  res.set('Allow', req.params.transactionId ? 'GET' : 'GET, POST');
  next(new MethodNotAllowedError('Transactions are immutable and cannot be modified or deleted'));
});

module.exports = router;
