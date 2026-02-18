const AppError = require('../libs/AppError');

/**
 * Axion-style global error handler.
 * Normalises all errors into a consistent envelope:
 *   { ok: false, code, message, details? }
 */
const errorHandler = (err, _req, res, _next) => {
  // ── Operational errors thrown by our code ──────────────────────────────────
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      ok:      false,
      code:    err.errorCode,
      message: err.message,
    });
  }

  // ── Mongoose ValidationError ───────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({
      field:   e.path,
      message: e.message,
    }));
    return res.status(400).json({
      ok:      false,
      code:    'VALIDATION_ERROR',
      message: 'Request validation failed',
      details,
    });
  }

  // ── Mongoose CastError (invalid ObjectId) ─────────────────────────────────
  if (err.name === 'CastError') {
    return res.status(400).json({
      ok:      false,
      code:    'INVALID_ID',
      message: `Invalid value for field '${err.path}'`,
    });
  }

  // ── MongoDB duplicate key ──────────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      ok:      false,
      code:    'DUPLICATE_KEY',
      message: `Duplicate value for '${field}'`,
    });
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      ok:      false,
      code:    'INVALID_TOKEN',
      message: err.message,
    });
  }

  // ── Unexpected / programming errors ───────────────────────────────────────
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({
    ok:      false,
    code:    'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
};

module.exports = errorHandler;
