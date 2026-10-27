const { runInTransaction } = require('../db');
const accounts = require('../repositories/accountRepository');
const transactions = require('../repositories/transactionRepository');
const {
  AccountNotFoundError,
  NotFoundError,
  InsufficientBalanceError,
  DuplicateTransactionError,
} = require('../errors');
const { serializeTransaction, paginationMeta } = require('./serializers');
const { toMinorUnits, toMajorUnits } = require('../utils/money');

function isDuplicateKeyError(err) {
  return err && err.code === 11000;
}

async function duplicateError(accountId, referenceId) {
  const existing = await transactions.findByReference(accountId, referenceId);
  return new DuplicateTransactionError(
    `A transaction with reference_id '${referenceId}' already exists for this account`,
    existing ? { existing_transaction: serializeTransaction(existing) } : undefined,
  );
}

/**
 * Apply a single credit/debit to an account. Must be called inside a DB transaction
 * (`session`): the transaction insert and the balance update commit together or not at all.
 */
async function applyTransaction(session, { accountId, type, amount, description, referenceId, transferId = null }) {
  const account = await accounts.findById(accountId, session);
  if (!account) throw new AccountNotFoundError(accountId);

  if (await transactions.findByReference(accountId, referenceId, session)) {
    throw await duplicateError(accountId, referenceId);
  }

  if (type === 'debit') {
    if (!(await accounts.debit(accountId, amount, session))) {
      throw new InsufficientBalanceError({
        account_id: String(accountId),
        balance: toMajorUnits(account.balance),
        requested_amount: toMajorUnits(amount),
      });
    }
  } else {
    await accounts.credit(accountId, amount, session);
  }

  return transactions.create(
    {
      account_id: accountId,
      type,
      amount,
      description: description ?? null,
      reference_id: referenceId,
      transfer_id: transferId,
    },
    session,
  );
}

module.exports = {
  applyTransaction,
  isDuplicateKeyError,

  async createTransaction(accountId, { type, amount, description, reference_id: referenceId }) {
    let created;
    try {
      created = await runInTransaction((session) =>
        applyTransaction(session, { accountId, type, amount: toMinorUnits(amount), description, referenceId }),
      );
    } catch (err) {
      // Safety net: the unique (account_id, reference_id) index catches any race the
      // pre-check missed. The DB transaction has already been aborted.
      if (isDuplicateKeyError(err)) throw await duplicateError(accountId, referenceId);
      throw err;
    }

    const account = await accounts.findById(accountId);
    return { transaction: serializeTransaction(created), balance: toMajorUnits(account.balance) };
  },

  async getTransaction(accountId, transactionId) {
    if (!(await accounts.findById(accountId))) throw new AccountNotFoundError(accountId);
    const txn = await transactions.findById(transactionId);
    if (!txn || String(txn.account_id) !== String(accountId)) {
      throw new NotFoundError(`Transaction '${transactionId}' not found for this account`, {
        transaction_id: transactionId,
      });
    }
    return serializeTransaction(txn);
  },

  async listTransactions(accountId, { type, page, limit }) {
    if (!(await accounts.findById(accountId))) throw new AccountNotFoundError(accountId);

    const { total, rows } = await transactions.findPage(accountId, { type, limit, offset: (page - 1) * limit });
    return {
      data: rows.map(serializeTransaction),
      pagination: paginationMeta({ page, limit, total }),
      filters: { type: type ?? null },
    };
  },
};
