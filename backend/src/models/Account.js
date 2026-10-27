const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    // Stored in integer minor units (cents). Starts at 0 and is only changed by
    // the transaction service through atomic $inc updates.
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: { validator: Number.isInteger, message: 'balance must be an integer number of minor units' },
    },
  },
  {
    collection: 'accounts',
    timestamps: { createdAt: 'created_at', updatedAt: false },
    versionKey: false,
  },
);

accountSchema.index({ created_at: -1, _id: -1 });

// Collection-level validator enforced by MongoDB itself (not just Mongoose).
const accountValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'balance', 'created_at'],
    properties: {
      name: { bsonType: 'string', minLength: 1 },
      balance: { bsonType: ['int', 'long', 'double'], minimum: 0 },
      created_at: { bsonType: 'date' },
    },
  },
};

const Account = mongoose.model('Account', accountSchema);

module.exports = { Account, accountValidator };
