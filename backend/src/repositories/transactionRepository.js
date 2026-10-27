const { Transaction } = require('../models');

const LATEST_FIRST = { created_at: -1, _id: -1 };

module.exports = {
  async create(txn, session) {
    const [doc] = await Transaction.create([txn], { session });
    return doc.toObject();
  },

  findById(id) {
    return Transaction.findById(id).lean();
  },

  findByReference(accountId, referenceId, session) {
    return Transaction.findOne({ account_id: accountId, reference_id: referenceId })
      .session(session ?? null)
      .lean();
  },

  async findPage(accountId, { type, limit, offset }) {
    const filter = { account_id: accountId };
    if (type) filter.type = type;

    const [total, rows] = await Promise.all([
      Transaction.countDocuments(filter),
      Transaction.find(filter).sort(LATEST_FIRST).skip(offset).limit(limit).lean(),
    ]);
    return { total, rows };
  },

  async summary() {
    const rows = await Transaction.aggregate([{ $group: { _id: '$type', count: { $sum: 1 }, volume: { $sum: '$amount' } } }]);
    const byType = Object.fromEntries(rows.map((r) => [r._id, r]));
    return {
      credit: { count: byType.credit?.count ?? 0, volume: byType.credit?.volume ?? 0 },
      debit: { count: byType.debit?.count ?? 0, volume: byType.debit?.volume ?? 0 },
    };
  },

  recent(limit) {
    return Transaction.find().sort(LATEST_FIRST).limit(limit).lean();
  },
};
