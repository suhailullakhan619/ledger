const { Transfer } = require('../models');

module.exports = {
  async create(transfer, session) {
    const [doc] = await Transfer.create([transfer], { session });
    return doc.toObject();
  },

  findByReference(fromAccountId, referenceId, session) {
    return Transfer.findOne({ from_account_id: fromAccountId, reference_id: referenceId })
      .session(session ?? null)
      .lean();
  },
};
