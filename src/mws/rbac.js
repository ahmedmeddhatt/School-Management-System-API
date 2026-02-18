const crypto = require('crypto');
const jwt    = require('jsonwebtoken');

const ROLES = { SUPER_ADMIN: 'SUPER_ADMIN', SCHOOL_ADMIN: 'SCHOOL_ADMIN' };

const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

/**
 * authenticate — supports two schemes:
 *   Bearer <jwt>    → standard JWT auth
 *   ApiKey <rawKey> → hashed → looked up in User.apiKeys
 */
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization || '';

  // ── JWT ──────────────────────────────────────────────────────────────────
  if (header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ ok: false, code: 'INVALID_TOKEN', message: 'Invalid or expired token' });
    }
  }

  // ── API Key ───────────────────────────────────────────────────────────────
  if (header.startsWith('ApiKey ')) {
    try {
      const rawKey = header.slice(7);
      const keyHash = sha256(rawKey);

      // Lazy-load User to avoid circular dependency at module level
      const User = require('../models/User');
      const user = await User.findOne({ 'apiKeys.keyHash': keyHash }).lean();

      if (!user) {
        return res.status(401).json({ ok: false, code: 'INVALID_API_KEY', message: 'Invalid API key' });
      }

      // Update lastUsed asynchronously — non-blocking
      User.findOneAndUpdate(
        { 'apiKeys.keyHash': keyHash },
        { $set: { 'apiKeys.$.lastUsed': new Date() } }
      ).exec().catch(() => {});

      req.user = {
        userId:   user._id,
        role:     user.role,
        schoolId: user.schoolId,
      };
      return next();
    } catch (err) {
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR', message: 'API key lookup failed' });
    }
  }

  res.status(401).json({ ok: false, code: 'UNAUTHORIZED', message: 'Missing or unsupported Authorization header' });
};

/**
 * Restricts access to the specified roles.
 */
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ ok: false, code: 'FORBIDDEN', message: 'Insufficient role' });
  }
  next();
};

/**
 * Ensures SCHOOL_ADMIN can only touch resources in their own school.
 */
const ownSchoolOnly = (req, res, next) => {
  if (req.user.role === ROLES.SUPER_ADMIN) return next();

  const resourceSchoolId =
    req.params.schoolId ||
    req.body.schoolId   ||
    req.query.schoolId  ||
    req.params.id;

  if (!resourceSchoolId || resourceSchoolId.toString() !== req.user.schoolId?.toString()) {
    return res.status(403).json({ error: 'Forbidden: access limited to your school' });
  }
  next();
};

module.exports = { authenticate, authorize, ownSchoolOnly, ROLES };
