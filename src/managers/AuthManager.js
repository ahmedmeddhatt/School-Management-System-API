const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode   = require('qrcode');
const User     = require('../models/User');
const AppError = require('../libs/AppError');

const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

class AuthManager {
  // ── Login ───────────────────────────────────────────────────────────────────
  async login(email, password) {
    const user = await User.findOne({ email }).select('+password +mfaSecret').lean();
    if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    const ok = await User.prototype.comparePassword.call(
      { password: user.password }, password
    );
    if (!ok) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    if (user.mfaEnabled) {
      // Return a short-lived pre-auth token; client must POST /auth/mfa/validate next
      const preToken = jwt.sign(
        { userId: user._id, mfaPending: true },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      return { mfaRequired: true, preToken };
    }

    return { mfaRequired: false, token: this._issueToken(user) };
  }

  // ── MFA Setup ───────────────────────────────────────────────────────────────
  async mfaSetup(userId) {
    const secret = speakeasy.generateSecret({ name: `SchoolAPI (${userId})`, length: 20 });

    await User.findByIdAndUpdate(userId, {
      mfaSecret:  secret.base32,
      mfaEnabled: false,            // enabled only after first successful verify
    });

    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    return { secret: secret.base32, qrDataUrl, otpauthUrl: secret.otpauth_url };
  }

  // ── MFA Activate (verify first token to confirm setup) ────────────────────
  async mfaActivate(userId, token) {
    const user = await User.findById(userId).select('+mfaSecret').lean();
    if (!user?.mfaSecret) throw new AppError('MFA not set up', 400, 'MFA_NOT_SETUP');

    const valid = speakeasy.totp.verify({
      secret:   user.mfaSecret,
      encoding: 'base32',
      token,
      window:   1,
    });
    if (!valid) throw new AppError('Invalid TOTP token', 401, 'INVALID_TOTP');

    await User.findByIdAndUpdate(userId, { mfaEnabled: true });
    return { mfaEnabled: true };
  }

  // ── MFA Validate (during login) ───────────────────────────────────────────
  async mfaValidate(preToken, totpToken) {
    let payload;
    try {
      payload = jwt.verify(preToken, process.env.JWT_SECRET);
    } catch {
      throw new AppError('Invalid or expired pre-auth token', 401, 'INVALID_TOKEN');
    }
    if (!payload.mfaPending) throw new AppError('Token is not a pre-auth token', 400, 'BAD_TOKEN');

    const user = await User.findById(payload.userId).select('+mfaSecret').lean();
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

    const valid = speakeasy.totp.verify({
      secret:   user.mfaSecret,
      encoding: 'base32',
      token:    totpToken,
      window:   1,
    });
    if (!valid) throw new AppError('Invalid TOTP token', 401, 'INVALID_TOTP');

    return { token: this._issueToken(user) };
  }

  // ── API Keys ──────────────────────────────────────────────────────────────
  async createApiKey(userId, name) {
    const rawKey = crypto.randomBytes(32).toString('hex'); // 64-char hex
    const keyHash = sha256(rawKey);

    await User.findByIdAndUpdate(userId, {
      $push: { apiKeys: { name, keyHash } },
    });

    return { key: rawKey, name }; // raw key shown ONCE — not stored
  }

  async revokeApiKey(userId, keyId) {
    const result = await User.findByIdAndUpdate(
      userId,
      { $pull: { apiKeys: { _id: keyId } } },
      { new: true }
    );
    if (!result) throw new AppError('Key not found', 404, 'NOT_FOUND');
    return { revoked: true };
  }

  async listApiKeys(userId) {
    const user = await User.findById(userId).lean();
    return (user?.apiKeys || []).map(({ _id, name, lastUsed, createdAt }) => ({
      _id, name, lastUsed, createdAt,
    }));
  }

  // ── Helper ─────────────────────────────────────────────────────────────────
  _issueToken(user) {
    return jwt.sign(
      {
        userId:   user._id,
        role:     user.role,
        schoolId: user.schoolId ?? null,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }
}

module.exports = new AuthManager();
