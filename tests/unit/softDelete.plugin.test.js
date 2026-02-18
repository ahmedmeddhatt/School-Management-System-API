/**
 * Unit tests — softDelete.plugin.js
 * Tests schema field injection, pre-hook filter logic, and static methods.
 * No real DB needed.
 */

const softDeletePlugin = require('../../src/libs/softDelete.plugin');

describe('softDelete.plugin — schema setup', () => {
  let schema, addedFields, preHookCalls, statics;

  beforeEach(() => {
    addedFields  = {};
    preHookCalls = [];
    statics      = {};

    schema = {
      add:     jest.fn((f) => Object.assign(addedFields, f)),
      pre:     jest.fn((event, fn) => preHookCalls.push({ event, fn })),
      statics,
    };

    softDeletePlugin(schema);
  });

  test('adds deletedAt (Date, default null) and deletedBy (ObjectId) fields', () => {
    expect(schema.add).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: expect.objectContaining({ type: Date, default: null }),
        deletedBy: expect.any(Object),
      })
    );
  });

  test('registers pre-hooks for find, findOne, findOneAndUpdate, countDocuments, count', () => {
    const hookedEvents = preHookCalls.map((c) => c.event);
    ['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'count'].forEach((e) => {
      expect(hookedEvents).toContain(e);
    });
  });

  test('exposes softDelete, restore, findWithDeleted statics', () => {
    expect(typeof statics.softDelete).toBe('function');
    expect(typeof statics.restore).toBe('function');
    expect(typeof statics.findWithDeleted).toBe('function');
  });
});

describe('softDelete.plugin — pre-hook filter logic', () => {
  let schema, statics, hooksByEvent;

  beforeEach(() => {
    statics      = {};
    hooksByEvent = {};

    schema = {
      add:     jest.fn(),
      pre:     jest.fn((event, fn) => { hooksByEvent[event] = fn; }),
      statics,
    };

    softDeletePlugin(schema);
  });

  const makeQuery = (filter = {}) => ({
    getFilter: () => filter,
    where:     jest.fn(),
  });

  test('injects { deletedAt: null } when deletedAt not in filter', () => {
    const q = makeQuery({});
    hooksByEvent['find'].call(q);
    expect(q.where).toHaveBeenCalledWith({ deletedAt: null });
  });

  test('skips injection when deletedAt already present in filter', () => {
    const q = makeQuery({ deletedAt: { $ne: null } });
    hooksByEvent['find'].call(q);
    expect(q.where).not.toHaveBeenCalled();
  });

  test('skips injection when deletedAt: null explicitly set', () => {
    const q = makeQuery({ deletedAt: null });
    hooksByEvent['findOne'].call(q);
    expect(q.where).not.toHaveBeenCalled();
  });

  test('applies filter to findOneAndUpdate pre-hook too', () => {
    const q = makeQuery({ _id: 'abc' }); // no deletedAt
    hooksByEvent['findOneAndUpdate'].call(q);
    expect(q.where).toHaveBeenCalledWith({ deletedAt: null });
  });
});

describe('softDelete.plugin — static: softDelete()', () => {
  let statics;

  beforeEach(() => {
    statics = {};
    const schema = { add: jest.fn(), pre: jest.fn(), statics };
    softDeletePlugin(schema);
  });

  test('calls findByIdAndUpdate with deletedAt=now and deletedBy=actorId', async () => {
    const mockDoc = { _id: 'doc1', deletedAt: new Date(), deletedBy: 'user1' };
    const mockModel = {
      findByIdAndUpdate: jest.fn().mockResolvedValue(mockDoc),
    };

    const result = await statics.softDelete.call(mockModel, 'doc1', 'user1');

    expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'doc1',
      { $set: { deletedAt: expect.any(Date), deletedBy: 'user1' } },
      { new: true }
    );
    expect(result).toEqual(mockDoc);
  });

  test('sets deletedBy to null when actorId is omitted', async () => {
    const mockModel = { findByIdAndUpdate: jest.fn().mockResolvedValue(null) };
    await statics.softDelete.call(mockModel, 'doc1');
    expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'doc1',
      { $set: { deletedAt: expect.any(Date), deletedBy: null } },
      { new: true }
    );
  });
});

describe('softDelete.plugin — static: restore()', () => {
  let statics;

  beforeEach(() => {
    statics = {};
    const schema = { add: jest.fn(), pre: jest.fn(), statics };
    softDeletePlugin(schema);
  });

  test('queries { deletedAt: { $ne: null } } to bypass auto-filter', async () => {
    const mockDoc = { _id: 'doc1', deletedAt: null };
    const mockModel = { findOneAndUpdate: jest.fn().mockResolvedValue(mockDoc) };

    const result = await statics.restore.call(mockModel, 'doc1');

    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'doc1', deletedAt: { $ne: null } },
      { $set: { deletedAt: null, deletedBy: null } },
      { new: true }
    );
    expect(result).toEqual(mockDoc);
  });

  test('returns null when no deleted document found', async () => {
    const mockModel = { findOneAndUpdate: jest.fn().mockResolvedValue(null) };
    const result = await statics.restore.call(mockModel, 'ghost');
    expect(result).toBeNull();
  });
});
