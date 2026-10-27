const { ValidationError } = require('../errors');

function formatIssues(issues) {
  return issues.map((issue) => ({
    field: issue.path.join('.') || null,
    message: issue.code === 'unrecognized_keys' ? `Unknown field(s): ${issue.keys.join(', ')}` : issue.message,
  }));
}

/**
 * Validate `req[source]` against a Zod schema. The parsed (trimmed / defaulted)
 * value is stored on `req.validated[source]` for the route handler to use.
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const input = req[source];

    if (source === 'body' && (input === undefined || input === null || typeof input !== 'object' || Array.isArray(input))) {
      return next(new ValidationError('Request body must be a JSON object'));
    }

    const result = schema.safeParse(input ?? {});
    if (!result.success) {
      const message = source === 'query' ? 'Invalid query parameters' : 'Invalid request body';
      return next(new ValidationError(message, formatIssues(result.error.issues)));
    }

    req.validated = { ...req.validated, [source]: result.data };
    return next();
  };
}

module.exports = { validate };
