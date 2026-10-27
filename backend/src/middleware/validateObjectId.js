const { ValidationError } = require('../errors');

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** `router.param` handler: reject malformed ids with 400 before they reach the database. */
function validateObjectIdParam(req, res, next, value, name) {
  if (!OBJECT_ID.test(value)) {
    return next(new ValidationError(`Invalid ${name}: '${value}' is not a valid id`, [{ field: name, message: `${name} is not a valid id` }]));
  }
  return next();
}

module.exports = { validateObjectIdParam };
