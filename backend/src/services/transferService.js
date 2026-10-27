const { runInTransaction } = require('../db');
const accounts = require('../repositories/accountRepository');
const transfers = require('../repositories/transferRepository');
const { AccountNotFoundError, DuplicateTransactionError } = require('../errors');
const { applyTransaction, isDuplicateKeyError } = require('./transactionService');
const { serializeTransfer, serializeTransaction } = require('./serializers');
const { toMinorUnits, toMajorUnits } = require('../utils/money');

async function duplicateError(fromAccountId, referenceId) {
  const existing = await transfers.findByReference(fromAccountId, referenceId);
  return new DuplicateTransactionError(
    `A transfer with reference_id '${referenceId}' already exists for the source account`,
    existing ? { existing_transfer: serializeTransfer(existing) } : undefined,
  );
}

module.exports = {
  /**
   * Move money between two accounts. The transfer record, the debit on the source
   * and the credit on the destination run in one DB transaction: if any step
   * fails (missing account, insufficient funds, duplicate reference) everything
   * is rolled back and no partial transfer can exist.
   */
  async createTransfer({ from_account_id: fromId, to_account_id: toId, amount, description, reference_id: referenceId }) {
    const minor = toMinorUnits(amount);

    let result;
    try {
      result = await runInTransaction(async (session) => {
        // Validate both accounts before touching anything.
        if (!(await accounts.findById(fromId, session))) throw new AccountNotFoundError(fromId);
        if (!(await accounts.findById(toId, session))) throw new AccountNotFoundError(toId);
        if (await transfers.findByReference(fromId, referenceId, session)) throw await duplicateError(fromId, referenceId);

        const transfer = await transfers.create(
          {
            from_account_id: fromId,
            to_account_id: toId,
            amount: minor,
            description: description ?? null,
            reference_id: referenceId,
          },
          session,
        );

        const common = { amount: minor, description, referenceId, transferId: transfer._id };
        const debit = await applyTransaction(session, { ...common, accountId: fromId, type: 'debit' });
        const credit = await applyTransaction(session, { ...common, accountId: toId, type: 'credit' });

        return { transfer, debit, credit };
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) throw await duplicateError(fromId, referenceId);
      throw err;
    }

    const [from, to] = await Promise.all([accounts.findById(fromId), accounts.findById(toId)]);
    return {
      transfer: serializeTransfer(result.transfer),
      transactions: {
        debit: serializeTransaction(result.debit),
        credit: serializeTransaction(result.credit),
      },
      balances: {
        from_account: { account_id: fromId, balance: toMajorUnits(from.balance) },
        to_account: { account_id: toId, balance: toMajorUnits(to.balance) },
      },
    };
  },
};
