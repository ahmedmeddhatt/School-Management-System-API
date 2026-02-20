const router      = require('express').Router();
const authManager = require('../managers/AuthManager');
const { authenticate, authorize, ROLES } = require('../mws/rbac');
const validate    = require('../mws/validate');
const {
  login, register, createApiKey,
} = require('../mws/schemas/auth.schema');

// POST /auth/register
router.post('/register', validate(register), async (req, res, next) => {
  try {
    const result = await authManager.register(req.body);
    res.status(201).json({ ok: true, ...result });
  } catch (err) { next(err); }
});

// POST /auth/login
router.post('/login', validate(login), async (req, res, next) => {
  try {
    const result = await authManager.login(req.body.email, req.body.password);
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

// ── Routes below require a valid JWT ─────────────────────────────────────────
router.use(authenticate);

// GET  /auth/users           — list all users (SUPER_ADMIN only)
router.get('/users', authorize(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const users = await authManager.listUsers();
    res.json({ ok: true, data: users });
  } catch (err) { next(err); }
});

// GET  /auth/users/:id       — get user by id (SUPER_ADMIN only)
router.get('/users/:id', authorize(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const user = await authManager.getUserById(req.params.id);
    if (!user) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'User not found' });
    res.json({ ok: true, data: user });
  } catch (err) { next(err); }
});

// GET  /auth/api-keys        — list keys (no hashes exposed)
router.get('/api-keys', async (req, res, next) => {
  try {
    const keys = await authManager.listApiKeys(req.user.userId);
    res.json({ ok: true, data: keys });
  } catch (err) { next(err); }
});

// POST /auth/api-keys        — create key (raw key returned ONCE)
router.post('/api-keys', validate(createApiKey), async (req, res, next) => {
  try {
    const result = await authManager.createApiKey(req.user.userId, req.body.name);
    res.status(201).json({ ok: true, data: result });
  } catch (err) { next(err); }
});

// DELETE /auth/api-keys/:keyId — revoke key
router.delete('/api-keys/:keyId', async (req, res, next) => {
  try {
    await authManager.revokeApiKey(req.user.userId, req.params.keyId);
    res.json({ ok: true, message: 'API key revoked' });
  } catch (err) { next(err); }
});

module.exports = router;
