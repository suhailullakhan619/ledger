const { Account } = require('../models');

module.exports = {
  async create({ name }, session) {
    // balance is never taken from input: it always starts at the schema default (0).
    const [account] = await Account.create([{ name }], { session });
    return account.toObject();
  },

  findById(id, session) {
    return Account.findById(id).session(session ?? null).lean();
  },

  async findPage({ limit, offset }) {
    const [total, rows] = await Promise.all([
      Account.countDocuments(),
      Account.find().sort({ created_at: -1, _id: -1 }).skip(offset).limit(limit).lean(),
    ]);
    return { total, rows };
  },

  async summary() {
    const [result] = await Account.aggregate([
      { $group: { _id: null, total_accounts: { $sum: 1 }, total_balance: { $sum: '$balance' } } },
    ]);
    return result ?? { total_accounts: 0, total_balance: 0 };
  },

  async credit(id, amount, session) {
    const res = await Account.updateOne({ _id: id }, { $inc: { balance: amount } }, { session });
    return res.modifiedCount === 1;
  },

  /** Conditional update: only succeeds when the balance covers the debit. */
  async debit(id, amount, session) {
    const res = await Account.updateOne(
      { _id: id, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { session },
    );
    return res.modifiedCount === 1;
  },
};
