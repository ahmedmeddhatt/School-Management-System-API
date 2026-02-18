/**
 * Unit tests — AuthManager.js
 *
 * Covers: login, mfaSetup, mfaActivate, mfaValidate,
 *         createApiKey, revokeApiKey, listApiKeys
 */

jest.mock('../../src/models/User');
jest.mock('speakeasy');
jest.mock('qrcode');
jest.mock('jsonwebtoken');

const User      = require('../../src/models/User');
const speakeasy = require('speakeasy');
const qrcode    = require('qrcode');
const jwt       = require('jsonwebtoken');
const AppError  = require('../../src/libs/AppError');

// Must be set before AuthManager is loaded so jwt.sign receives a string secret
process.env.JWT_SECRET     = 'test-secret';
process.env.JWT_EXPIRES_IN = '7d';

const authManager = require('../../src/managers/AuthManager');

const USER_ID   = '507f1f77bcf86cd799439011';
const mockUser  = {
  _id:        USER_ID,
  email:      'admin@school.com',
  password:   'hashed',
  role:       'SUPER_ADMIN',
  schoolId:   null,
  mfaEnabled: false,
  mfaSecret:  null,
};

// comparePassword lives on User.prototype — set it up once
beforeAll(() => {
  User.prototype.comparePassword = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  jwt.sign.mockReturnValue('signed.jwt.token');
});

// ── login ─────────────────────────────────────────────────────────────────────
describe('AuthManager.login', () => {
  test('valid credentials (no MFA) → returns JWT token', async () => {
    User.findOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(mockUser) }) });
    User.prototype.comparePassword.mockResolvedValue(true);

    const result = await authManager.login('admin@school.com', 'password');

    expect(result).toEqual({ mfaRequired: false, token: 'signed.jwt.token' });
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, role: 'SUPER_ADMIN' }),
      'test-secret',
      expect.any(Object)
    );
  });

  test('valid credentials + MFA enabled → returns preToken + mfaRequired:true', async () => {
    const mfaUser = { ...mockUser, mfaEnabled: true, mfaSecret: 'SECRET' };
    User.findOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(mfaUser) }) });
    User.prototype.comparePassword.mockResolvedValue(true);
    jwt.sign.mockReturnValue('pre.auth.token');

    const result = await authManager.login('admin@school.com', 'password');

    expect(result.mfaRequired).toBe(true);
    expect(result.preToken).toBe('pre.auth.token');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ mfaPending: true }),
      'test-secret',
      expect.objectContaining({ expiresIn: '5m' })
    );
  });

  test('unknown email → throws 401 INVALID_CREDENTIALS', async () => {
    User.findOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(null) }) });

    await expect(authManager.login('nobody@x.com', 'pass'))
      .rejects.toMatchObject({ statusCode: 401, errorCode: 'INVALID_CREDENTIALS' });
  });

  test('wrong password → throws 401 INVALID_CREDENTIALS', async () => {
    User.findOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(mockUser) }) });
    User.prototype.comparePassword.mockResolvedValue(false);

    await expect(authManager.login('admin@school.com', 'wrong'))
      .rejects.toMatchObject({ statusCode: 401, errorCode: 'INVALID_CREDENTIALS' });
  });
});

// ── mfaSetup ──────────────────────────────────────────────────────────────────
describe('AuthManager.mfaSetup', () => {
  test('generates secret, stores it, returns secret + qrDataUrl', async () => {
    speakeasy.generateSecret.mockReturnValue({
      base32:      'BASE32SECRET',
      otpauth_url: 'otpauth://totp/...',
    });
    qrcode.toDataURL.mockResolvedValue('data:image/png;base64,...');
    User.findByIdAndUpdate.mockResolvedValue({});

    const result = await authManager.mfaSetup(USER_ID);

    expect(speakeasy.generateSecret).toHaveBeenCalledWith(
      expect.objectContaining({ length: 20 })
    );
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ mfaSecret: 'BASE32SECRET', mfaEnabled: false })
    );
    expect(result.secret).toBe('BASE32SECRET');
    expect(result.qrDataUrl).toBe('data:image/png;base64,...');
  });
});

// ── mfaActivate ───────────────────────────────────────────────────────────────
describe('AuthManager.mfaActivate', () => {
  test('valid TOTP token → enables MFA, returns { mfaEnabled: true }', async () => {
    const userWithSecret = { ...mockUser, mfaSecret: 'MYSECRET' };
    User.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(userWithSecret) }) });
    speakeasy.totp.verify.mockReturnValue(true);
    User.findByIdAndUpdate.mockResolvedValue({});

    const result = await authManager.mfaActivate(USER_ID, '123456');

    expect(speakeasy.totp.verify).toHaveBeenCalledWith(
      expect.objectContaining({ secret: 'MYSECRET', token: '123456', encoding: 'base32' })
    );
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(USER_ID, { mfaEnabled: true });
    expect(result).toEqual({ mfaEnabled: true });
  });

  test('invalid TOTP token → throws 401 INVALID_TOTP', async () => {
    const userWithSecret = { ...mockUser, mfaSecret: 'MYSECRET' };
    User.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(userWithSecret) }) });
    speakeasy.totp.verify.mockReturnValue(false);

    await expect(authManager.mfaActivate(USER_ID, '000000'))
      .rejects.toMatchObject({ statusCode: 401, errorCode: 'INVALID_TOTP' });
  });

  test('no mfaSecret set → throws 400 MFA_NOT_SETUP', async () => {
    User.findById.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ ...mockUser, mfaSecret: null }) }),
    });

    await expect(authManager.mfaActivate(USER_ID, '123456'))
      .rejects.toMatchObject({ statusCode: 400, errorCode: 'MFA_NOT_SETUP' });
  });
});

// ── mfaValidate ───────────────────────────────────────────────────────────────
describe('AuthManager.mfaValidate', () => {
  test('valid preToken + valid TOTP → returns full JWT', async () => {
    jwt.verify.mockReturnValue({ userId: USER_ID, mfaPending: true });
    const mfaUser = { ...mockUser, mfaSecret: 'SECRET', mfaEnabled: true };
    User.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(mfaUser) }) });
    speakeasy.totp.verify.mockReturnValue(true);
    jwt.sign.mockReturnValue('full.jwt.token');

    const result = await authManager.mfaValidate('pre.token', '654321');

    expect(result).toEqual({ token: 'full.jwt.token' });
  });

  test('invalid preToken → throws 401 INVALID_TOKEN', async () => {
    jwt.verify.mockImplementation(() => { throw new Error('expired'); });

    await expect(authManager.mfaValidate('bad.token', '123456'))
      .rejects.toMatchObject({ statusCode: 401, errorCode: 'INVALID_TOKEN' });
  });

  test('non-MFA preToken (mfaPending missing) → throws 400 BAD_TOKEN', async () => {
    jwt.verify.mockReturnValue({ userId: USER_ID }); // no mfaPending

    await expect(authManager.mfaValidate('regular.token', '123456'))
      .rejects.toMatchObject({ statusCode: 400, errorCode: 'BAD_TOKEN' });
  });

  test('valid preToken but wrong TOTP → throws 401 INVALID_TOTP', async () => {
    jwt.verify.mockReturnValue({ userId: USER_ID, mfaPending: true });
    User.findById.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ ...mockUser, mfaSecret: 'SEC' }) }),
    });
    speakeasy.totp.verify.mockReturnValue(false);

    await expect(authManager.mfaValidate('pre.token', '000000'))
      .rejects.toMatchObject({ statusCode: 401, errorCode: 'INVALID_TOTP' });
  });
});

// ── API Keys ──────────────────────────────────────────────────────────────────
describe('AuthManager.createApiKey', () => {
  test('returns raw key (64-char hex) and key name', async () => {
    User.findByIdAndUpdate.mockResolvedValue({});

    const result = await authManager.createApiKey(USER_ID, 'CI Pipeline');

    expect(result.name).toBe('CI Pipeline');
    expect(result.key).toMatch(/^[a-f0-9]{64}$/);
  });

  test('stores SHA-256 hash (not raw key) in User.apiKeys', async () => {
    User.findByIdAndUpdate.mockResolvedValue({});

    const { key } = await authManager.createApiKey(USER_ID, 'Test Key');

    const [, updateArg] = User.findByIdAndUpdate.mock.calls[0];
    const storedHash = updateArg.$push.apiKeys.keyHash;

    // Hash must not equal raw key
    expect(storedHash).not.toBe(key);
    // Hash must be 64-char hex (SHA-256)
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
    // Same key must produce the same hash
    const crypto = require('crypto');
    expect(storedHash).toBe(crypto.createHash('sha256').update(key).digest('hex'));
  });

  test('two calls produce different raw keys', async () => {
    User.findByIdAndUpdate.mockResolvedValue({});

    const { key: key1 } = await authManager.createApiKey(USER_ID, 'Key1');
    const { key: key2 } = await authManager.createApiKey(USER_ID, 'Key2');

    expect(key1).not.toBe(key2);
  });
});

describe('AuthManager.revokeApiKey', () => {
  test('calls $pull to remove the key by _id', async () => {
    User.findByIdAndUpdate.mockResolvedValue({ apiKeys: [] });

    await authManager.revokeApiKey(USER_ID, 'key123');

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      USER_ID,
      { $pull: { apiKeys: { _id: 'key123' } } },
      { new: true }
    );
  });

  test('throws 404 NOT_FOUND when user not found', async () => {
    User.findByIdAndUpdate.mockResolvedValue(null);

    await expect(authManager.revokeApiKey(USER_ID, 'badId'))
      .rejects.toMatchObject({ statusCode: 404, errorCode: 'NOT_FOUND' });
  });
});

describe('AuthManager.listApiKeys', () => {
  test('returns keys with _id, name, lastUsed, createdAt — no keyHash', async () => {
    const userWithKeys = {
      apiKeys: [
        { _id: 'k1', name: 'CI', keyHash: 'secret-hash', lastUsed: null, createdAt: new Date() },
      ],
    };
    User.findById.mockReturnValue({ lean: () => Promise.resolve(userWithKeys) });

    const result = await authManager.listApiKeys(USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ _id: 'k1', name: 'CI' });
    expect(result[0].keyHash).toBeUndefined(); // hash must NEVER be returned
  });

  test('returns empty array when user has no API keys', async () => {
    User.findById.mockReturnValue({ lean: () => Promise.resolve({ apiKeys: [] }) });

    const result = await authManager.listApiKeys(USER_ID);
    expect(result).toEqual([]);
  });
});
