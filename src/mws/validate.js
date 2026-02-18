const AppError = require('../libs/AppError');

/**
 * Middleware factory — validates req.body against a Joi schema.
 * Passes a 400 AppError to next() on failure.
 */
const validate = (schema) => (req, _res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });

  if (error) {
    const details = error.details.map((d) => ({
      field:   d.path.join('.'),
      message: d.message.replace(/['"]/g, ''),
    }));
    const err = new AppError('Request validation failed', 400, 'VALIDATION_ERROR');
    err.details = details;
    return next(err);
  }

  next();
};

module.exports = validate;
