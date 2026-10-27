const mongoose = require('mongoose');
const { immutablePlugin } = require('./immutable');

const transactionSchema = new mongoose.Schema(
  {
    account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, immutable: true },
    type: { type: String, enum: ['credit', 'debit'], required: true, immutable: true },
    // Integer minor units (cents).
    amount: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
      validate: { validator: Number.isInteger, message: 'amount must be an integer number of minor units' },
    },
    description: { type: String, default: null, maxlength: 500, immutable: true },
    reference_id: { type: String, required: true, trim: true, minlength: 1, maxlength: 100, immutable: true },
    transfer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transfer', default: null, immutable: true },
  },
  {
    collection: 'transactions',
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
  },
);

// reference_id is unique per account (the same reference may appear on different accounts).
transactionSchema.index({ account_id: 1, reference_id: 1 }, { unique: true });
// History queries: latest first, optionally filtered by type. _id breaks created_at ties.
transactionSchema.index({ account_id: 1, created_at: -1, _id: -1 });
transactionSchema.index({ account_id: 1, type: 1, created_at: -1, _id: -1 });

transactionSchema.plugin(immutablePlugin, { name: 'Transactions' });

const transactionValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['account_id', 'type', 'amount', 'reference_id', 'created_at'],
    properties: {
      account_id: { bsonType: 'objectId' },
      type: { enum: ['credit', 'debit'] },
      amount: { bsonType: ['int', 'long', 'double'], minimum: 1 },
      reference_id: { bsonType: 'string', minLength: 1 },
      created_at: { bsonType: 'date' },
    },
  },
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = { Transaction, transactionValidator };
