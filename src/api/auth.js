const router      = require('express').Router();
const authManager = require('../managers/AuthManager');
const { authenticate } = require('../mws/rbac');
const validate    = require('../mws/validate');
const {
  login, mfaActivate, mfaValidate, createApiKey,
} = require('../mws/schemas/auth.schema');

// POST /auth/login
router.post('/login', validate(login), async (req, res, next) => {
  try {
    const result = await authManager.login(req.body.email, req.body.password);
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

// POST /auth/mfa/validate  — step 2 of MFA login
router.post('/mfa/validate', validate(mfaValidate), async (req, res, next) => {
  try {
    const result = await authManager.mfaValidate(req.body.preToken, req.body.totpToken);
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

// ── Routes below require a valid JWT ─────────────────────────────────────────
router.use(authenticate);

// POST /auth/mfa/setup  — generate secret + QR code
router.post('/mfa/setup', async (req, res, next) => {
  try {
    const data = await authManager.mfaSetup(req.user.userId);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
});

// POST /auth/mfa/activate  — confirm first TOTP token to enable MFA
router.post('/mfa/activate', validate(mfaActivate), async (req, res, next) => {
  try {
    const result = await authManager.mfaActivate(req.user.userId, req.body.token);
    res.json({ ok: true, ...result });
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
