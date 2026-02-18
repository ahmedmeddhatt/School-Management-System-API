/**
 * Cache Invalidation Tests — SchoolManager
 *
 * Verifies that Redis cache is correctly populated, overwritten on update,
 * and deleted on remove. No real DB or Redis needed — all mocked.
 *
 * Scenario:
 *   1. GET /schools/:id  → cache MISS → fetches DB → writes to Redis
 *   2. GET /schools/:id  → cache HIT  → returns Redis data (DB never called)
 *   3. PUT /schools/:id  → updates DB → overwrites Redis with fresh data
 *   4. GET /schools/:id  → cache HIT  → returns NEW name (no stale data)
 *   5. DELETE /schools/:id → removes DB doc → calls redis.del (cache purged)
 */

jest.mock('../../src/models/School');
jest.mock('../../src/loaders/redis');

const School      = require('../../src/models/School');
const redisLoader = require('../../src/loaders/redis');

// Inline require AFTER mocks so SchoolManager picks up mocked modules
const schoolManager = require('../../src/managers/SchoolManager');

const SCHOOL_ID   = '507f1f77bcf86cd799439011';
const CACHE_KEY   = `school:${SCHOOL_ID}`;
const schoolDoc   = { _id: SCHOOL_ID, name: 'Old Name', address: '1 Main St', adminId: 'admin1' };
const updatedDoc  = { ...schoolDoc, name: 'New Name' };

// Shared mock Redis client instance
const mockRedis = {
  get:   jest.fn(),
  setex: jest.fn(),
  del:   jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  redisLoader.getClient.mockReturnValue(mockRedis);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const dbFindById    = (doc) => School.findById.mockReturnValue({ lean: () => Promise.resolve(doc) });
const dbFindUpdate  = (doc) => School.findByIdAndUpdate.mockReturnValue({ lean: () => Promise.resolve(doc) });
const dbFindDelete  = (doc) => School.findByIdAndDelete.mockReturnValue({ lean: () => Promise.resolve(doc) });
const redisMiss     = ()    => mockRedis.get.mockResolvedValue(null);
const redisHit      = (doc) => mockRedis.get.mockResolvedValue(JSON.stringify(doc));

// ── GET ───────────────────────────────────────────────────────────────────────
describe('getById — cache miss / hit', () => {
  test('cache MISS: reads DB and stores result in Redis', async () => {
    redisMiss();
    dbFindById(schoolDoc);

    const result = await schoolManager.getById(SCHOOL_ID);

    expect(mockRedis.get).toHaveBeenCalledWith(CACHE_KEY);
    expect(School.findById).toHaveBeenCalledWith(SCHOOL_ID);
    expect(mockRedis.setex).toHaveBeenCalledWith(
      CACHE_KEY,
      expect.any(Number),
      JSON.stringify(schoolDoc)
    );
    expect(result).toEqual(schoolDoc);
  });

  test('cache HIT: returns Redis data without touching DB', async () => {
    redisHit(schoolDoc);

    const result = await schoolManager.getById(SCHOOL_ID);

    expect(mockRedis.get).toHaveBeenCalledWith(CACHE_KEY);
    expect(School.findById).not.toHaveBeenCalled();
    expect(result).toEqual(schoolDoc);
  });

  test('returns null when document does not exist', async () => {
    redisMiss();
    dbFindById(null);

    const result = await schoolManager.getById(SCHOOL_ID);

    expect(result).toBeNull();
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });
});

// ── UPDATE ────────────────────────────────────────────────────────────────────
describe('update — cache overwrite (no stale data)', () => {
  test('UPDATE overwrites cache with fresh document via setex', async () => {
    dbFindUpdate(updatedDoc);

    await schoolManager.update(SCHOOL_ID, { name: 'New Name' });

    expect(mockRedis.setex).toHaveBeenCalledWith(
      CACHE_KEY,
      expect.any(Number),
      JSON.stringify(updatedDoc)
    );
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  test('GET after UPDATE returns new name (not stale cached value)', async () => {
    // Step 1: initial GET — cache miss, populate with old data
    redisMiss();
    dbFindById(schoolDoc);
    await schoolManager.getById(SCHOOL_ID);

    // Step 2: UPDATE — overwrites cache with new data
    dbFindUpdate(updatedDoc);
    await schoolManager.update(SCHOOL_ID, { name: 'New Name' });

    // Step 3: second GET — cache now has updatedDoc
    redisHit(updatedDoc);
    const result = await schoolManager.getById(SCHOOL_ID);

    expect(result.name).toBe('New Name');
    // DB was NOT called again for the second GET
    expect(School.findById).toHaveBeenCalledTimes(1);
  });

  test('UPDATE returns null and skips cache when document not found', async () => {
    dbFindUpdate(null);

    const result = await schoolManager.update(SCHOOL_ID, { name: 'Ghost' });

    expect(result).toBeNull();
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────
describe('delete — cache purge', () => {
  test('DELETE calls redis.del to remove stale cache entry', async () => {
    dbFindDelete(schoolDoc);

    await schoolManager.delete(SCHOOL_ID);

    expect(mockRedis.del).toHaveBeenCalledWith(CACHE_KEY);
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });

  test('DELETE returns null and skips redis.del when document not found', async () => {
    dbFindDelete(null);

    const result = await schoolManager.delete(SCHOOL_ID);

    expect(result).toBeNull();
    expect(mockRedis.del).not.toHaveBeenCalled();
  });
});
