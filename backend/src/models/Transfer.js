const mongoose = require('mongoose');
const { immutablePlugin } = require('./immutable');

const transferSchema = new mongoose.Schema(
  {
    from_account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, immutable: true },
    to_account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, immutable: true },
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
  },
  {
    collection: 'transfers',
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
  },
);

transferSchema.index({ from_account_id: 1, reference_id: 1 }, { unique: true });

transferSchema.plugin(immutablePlugin, { name: 'Transfers' });

const transferValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['from_account_id', 'to_account_id', 'amount', 'reference_id', 'created_at'],
    properties: {
      from_account_id: { bsonType: 'objectId' },
      to_account_id: { bsonType: 'objectId' },
      amount: { bsonType: ['int', 'long', 'double'], minimum: 1 },
      reference_id: { bsonType: 'string', minLength: 1 },
      created_at: { bsonType: 'date' },
    },
  },
};

const Transfer = mongoose.model('Transfer', transferSchema);

module.exports = { Transfer, transferValidator };
