const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const AppError = require('../libs/AppError');

const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

class AuthManager {
  // ── Register ────────────────────────────────────────────────────────────────
  async register({ email, password }) {
    const existing = await User.findOne({ email }).lean();
    if (existing) throw new AppError('Email already in use', 409, 'EMAIL_TAKEN');

    const user = await User.create({ email, password, role: 'SCHOOL_ADMIN', schoolId: null });
    return { token: this._issueToken(user) };
  }

  // ── Login ───────────────────────────────────────────────────────────────────
  async login(email, password) {
    const user = await User.findOne({ email }).select('+password').lean();
    if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    const ok = await User.prototype.comparePassword.call(
      { password: user.password }, password
    );
    if (!ok) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    return { token: this._issueToken(user) };
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  async listUsers() {
    return User.find({}).select('-apiKeys.keyHash').lean();
  }

  async getUserById(id) {
    return User.findById(id).select('-apiKeys.keyHash').lean();
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
