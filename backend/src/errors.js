class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

class NotFoundError extends AppError {
  constructor(message, details) {
    super(404, 'NOT_FOUND', message, details);
  }
}

class AccountNotFoundError extends AppError {
  constructor(accountId) {
    super(404, 'ACCOUNT_NOT_FOUND', `Account '${accountId}' not found`, { account_id: accountId });
  }
}

class InsufficientBalanceError extends AppError {
  constructor(details) {
    super(422, 'INSUFFICIENT_BALANCE', 'Insufficient balance for this debit', details);
  }
}

class DuplicateTransactionError extends AppError {
  constructor(message, existing) {
    super(409, 'DUPLICATE_TRANSACTION', message, existing);
  }
}

class MethodNotAllowedError extends AppError {
  constructor(message) {
    super(405, 'METHOD_NOT_ALLOWED', message);
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  MethodNotAllowedError,
  AccountNotFoundError,
  InsufficientBalanceError,
  DuplicateTransactionError,
};
