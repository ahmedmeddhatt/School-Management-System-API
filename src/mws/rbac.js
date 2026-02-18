const jwt = require('jsonwebtoken');

const ROLES = { SUPER_ADMIN: 'SUPER_ADMIN', SCHOOL_ADMIN: 'SCHOOL_ADMIN' };

/**
 * Verifies JWT and attaches decoded payload to req.user.
 */
const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Restricts access to the specified roles.
 * @param {...string} roles
 */
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  }
  next();
};

/**
 * Ensures SCHOOL_ADMIN can only touch resources in their own school.
 * Reads schoolId from: req.params, req.body, or req.query.
 */
const ownSchoolOnly = (req, res, next) => {
  if (req.user.role === ROLES.SUPER_ADMIN) return next();

  const resourceSchoolId =
    req.params.schoolId ||
    req.body.schoolId ||
    req.query.schoolId ||
    req.params.id;          // used when the resource IS a school document

  if (!resourceSchoolId || resourceSchoolId.toString() !== req.user.schoolId.toString()) {
    return res.status(403).json({ error: 'Forbidden: access limited to your school' });
  }
  next();
};

module.exports = { authenticate, authorize, ownSchoolOnly, ROLES };
