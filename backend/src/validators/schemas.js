const { z } = require('zod');
const { isValidObjectId } = require('mongoose');
const config = require('../config');
const { MAX_AMOUNT, hasAtMostTwoDecimals } = require('../utils/money');

const requiredString = (field, max) =>
  z
    .string({ error: (issue) => (issue.input === undefined ? `${field} is required` : `${field} must be a string`) })
    .trim()
    .min(1, `${field} must not be empty`)
    .max(max, `${field} must be at most ${max} characters`);

const objectId = (field) =>
  requiredString(field, 24).refine((v) => isValidObjectId(v) && /^[0-9a-fA-F]{24}$/.test(v), `${field} is not a valid id`);

const amount = z
  .number({ error: (issue) => (issue.input === undefined ? 'amount is required' : 'amount must be a number') })
  .refine(Number.isFinite, 'amount must be a finite number')
  .refine((v) => v > 0, 'amount must be greater than 0')
  .refine((v) => v <= MAX_AMOUNT, `amount must not exceed ${MAX_AMOUNT}`)
  .refine(hasAtMostTwoDecimals, 'amount must have at most 2 decimal places');

const description = z
  .string({ error: 'description must be a string' })
  .trim()
  .max(500, 'description must be at most 500 characters')
  .optional()
  .nullable();

// .strict() rejects unknown keys, so clients cannot sneak in `balance`, `id`, `created_at`, etc.
const createAccountBody = z
  .object({
    name: requiredString('name', 200),
  })
  .strict();

const createTransactionBody = z
  .object({
    type: z.enum(['credit', 'debit'], {
      error: (issue) => (issue.input === undefined ? 'type is required' : "type must be either 'credit' or 'debit'"),
    }),
    amount,
    description,
    reference_id: requiredString('reference_id', 100),
  })
  .strict();

const createTransferBody = z
  .object({
    from_account_id: objectId('from_account_id'),
    to_account_id: objectId('to_account_id'),
    amount,
    description,
    reference_id: requiredString('reference_id', 100),
  })
  .strict()
  .refine((b) => b.from_account_id !== b.to_account_id, {
    message: 'from_account_id and to_account_id must be different',
    path: ['to_account_id'],
  });

const positiveIntParam = (field, def, max) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === '') return def;
      if (!/^\d+$/.test(v)) {
        ctx.addIssue({ code: 'custom', message: `${field} must be a positive integer` });
        return z.NEVER;
      }
      const n = Number(v);
      if (n < 1) {
        ctx.addIssue({ code: 'custom', message: `${field} must be greater than or equal to 1` });
        return z.NEVER;
      }
      if (max && n > max) {
        ctx.addIssue({ code: 'custom', message: `${field} must be less than or equal to ${max}` });
        return z.NEVER;
      }
      return n;
    });

const paginationQuery = {
  page: positiveIntParam('page', config.pagination.defaultPage),
  limit: positiveIntParam('limit', config.pagination.defaultLimit, config.pagination.maxLimit),
};

const listAccountsQuery = z.object(paginationQuery);

const listTransactionsQuery = z.object({
  type: z
    .enum(['credit', 'debit'], { error: "type must be either 'credit' or 'debit'" })
    .optional(),
  ...paginationQuery,
});

module.exports = {
  createAccountBody,
  createTransactionBody,
  createTransferBody,
  listAccountsQuery,
  listTransactionsQuery,
};
