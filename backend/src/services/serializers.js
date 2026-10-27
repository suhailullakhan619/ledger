const { toMajorUnits } = require('../utils/money');

const idOf = (value) => (value == null ? null : String(value));
const iso = (date) => (date instanceof Date ? date.toISOString() : date);

function serializeAccount(doc) {
  return {
    id: idOf(doc._id),
    name: doc.name,
    balance: toMajorUnits(doc.balance),
    created_at: iso(doc.created_at),
  };
}

function serializeTransaction(doc) {
  const txn = {
    id: idOf(doc._id),
    account_id: idOf(doc.account_id),
    type: doc.type,
    amount: toMajorUnits(doc.amount),
    description: doc.description ?? null,
    reference_id: doc.reference_id,
    created_at: iso(doc.created_at),
  };
  if (doc.transfer_id) txn.transfer_id = idOf(doc.transfer_id);
  return txn;
}

function serializeTransfer(doc) {
  return {
    id: idOf(doc._id),
    from_account_id: idOf(doc.from_account_id),
    to_account_id: idOf(doc.to_account_id),
    amount: toMajorUnits(doc.amount),
    description: doc.description ?? null,
    reference_id: doc.reference_id,
    created_at: iso(doc.created_at),
  };
}

function paginationMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total_records: total,
    total_pages: Math.ceil(total / limit),
    has_next_page: page * limit < total,
    has_previous_page: page > 1,
  };
}

module.exports = { serializeAccount, serializeTransaction, serializeTransfer, paginationMeta };
