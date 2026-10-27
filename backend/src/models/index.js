const { Account, accountValidator } = require('./Account');
const { Transaction, transactionValidator } = require('./Transaction');
const { Transfer, transferValidator } = require('./Transfer');

const MODELS = [
  { model: Account, validator: accountValidator },
  { model: Transaction, validator: transactionValidator },
  { model: Transfer, validator: transferValidator },
];

module.exports = { Account, Transaction, Transfer, MODELS };
