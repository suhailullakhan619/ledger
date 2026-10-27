const { AppError } = require('../errors');

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    return res.status(err.status).json(body);
  }

  // Malformed JSON from express.json()
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body contains malformed JSON' },
    });
  }

  // Unique index violation that slipped past the service-level checks.
  if (err.code === 11000) {
    return res.status(409).json({
      error: { code: 'DUPLICATE_TRANSACTION', message: 'A record with the same unique key already exists' },
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: `Invalid value for '${err.path}'` },
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
  });
}

module.exports = { notFoundHandler, errorHandler };
