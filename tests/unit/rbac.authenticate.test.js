/**
 * Unit tests — rbac.js :: authenticate middleware
 *
 * Covers:
 *   Bearer <jwt>    — valid, invalid, expired
 *   ApiKey <rawKey> — valid, unknown key
 *   Missing / unsupported header
 */

jest.mock('jsonwebtoken');
jest.mock('../../src/models/User');

const jwt  = require('jsonwebtoken');
const User = require('../../src/models/User');
const { authenticate } = require('../../src/mws/rbac');

const makeRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

// ── Bearer JWT ────────────────────────────────────────────────────────────────
describe('authenticate — Bearer JWT', () => {
  test('valid JWT: sets req.user and calls next()', async () => {
    const payload = { userId: 'u1', role: 'SUPER_ADMIN', schoolId: null };
    jwt.verify.mockReturnValue(payload);

    const req  = { headers: { authorization: 'Bearer valid.jwt' } };
    const res  = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('invalid JWT: returns 401 INVALID_TOKEN', async () => {
    jwt.verify.mockImplementation(() => { throw new Error('invalid signature'); });

    const req  = { headers: { authorization: 'Bearer bad.token' } };
    const res  = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_TOKEN' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('expired JWT: returns 401', async () => {
    const err  = new Error('jwt expired');
    err.name   = 'TokenExpiredError';
    jwt.verify.mockImplementation(() => { throw err; });

    const req  = { headers: { authorization: 'Bearer expired.token' } };
    const res  = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── ApiKey ────────────────────────────────────────────────────────────────────
describe('authenticate — ApiKey', () => {
  const mockUser = { _id: 'u2', role: 'SCHOOL_ADMIN', schoolId: 'school1' };

  test('valid API key: sets req.user with userId/role/schoolId and calls next()', async () => {
    User.findOne.mockReturnValue({ lean: () => Promise.resolve(mockUser) });
    User.findOneAndUpdate.mockReturnValue({ exec: () => Promise.resolve() });

    const req  = { headers: { authorization: 'ApiKey somerawkey123' } };
    const res  = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ 'apiKeys.keyHash': expect.any(String) })
    );
    expect(req.user).toMatchObject({
      userId:   mockUser._id,
      role:     'SCHOOL_ADMIN',
      schoolId: 'school1',
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('unknown API key: returns 401 INVALID_API_KEY', async () => {
    User.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const req  = { headers: { authorization: 'ApiKey unknownkey' } };
    const res  = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_API_KEY' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('same raw key always produces same hash (deterministic SHA-256)', async () => {
    const capturedHashes = [];
    User.findOne.mockImplementation((q) => {
      capturedHashes.push(q['apiKeys.keyHash']);
      return { lean: () => Promise.resolve(null) };
    });

    const req = { headers: { authorization: 'ApiKey fixedkey' } };
    await authenticate(req, makeRes(), jest.fn());
    await authenticate(req, makeRes(), jest.fn());

    expect(capturedHashes[0]).toBe(capturedHashes[1]);
    expect(capturedHashes[0]).toHaveLength(64); // SHA-256 hex
  });

  test('different raw keys produce different hashes', async () => {
    const hashes = [];
    User.findOne.mockImplementation((q) => {
      hashes.push(q['apiKeys.keyHash']);
      return { lean: () => Promise.resolve(null) };
    });

    await authenticate({ headers: { authorization: 'ApiKey keyA' } }, makeRes(), jest.fn());
    await authenticate({ headers: { authorization: 'ApiKey keyB' } }, makeRes(), jest.fn());

    expect(hashes[0]).not.toBe(hashes[1]);
  });
});

// ── Missing / unsupported header ──────────────────────────────────────────────
describe('authenticate — missing/unsupported header', () => {
  test('no Authorization header: returns 401 UNAUTHORIZED', async () => {
    const req  = { headers: {} };
    const res  = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('unsupported scheme (Basic): returns 401 UNAUTHORIZED', async () => {
    const req  = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    const res  = makeRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
