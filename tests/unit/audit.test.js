/**
 * Unit tests — audit.js helper
 */

jest.mock('../../src/models/AuditLog');
const AuditLog = require('../../src/models/AuditLog');
const audit    = require('../../src/libs/audit');

const PAYLOAD = {
  action:       'SOFT_DELETE',
  resourceType: 'School',
  resourceId:   '507f1f77bcf86cd799439011',
  performedBy:  '507f1f77bcf86cd799439022',
  schoolId:     '507f1f77bcf86cd799439011',
};

beforeEach(() => jest.clearAllMocks());

describe('audit.log', () => {
  test('calls AuditLog.create with the provided payload', async () => {
    AuditLog.create.mockResolvedValue({});

    await audit.log(PAYLOAD);

    expect(AuditLog.create).toHaveBeenCalledTimes(1);
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action:       'SOFT_DELETE',
      resourceType: 'School',
      resourceId:   PAYLOAD.resourceId,
      performedBy:  PAYLOAD.performedBy,
    }));
  });

  test('passes changes snapshot when provided', async () => {
    AuditLog.create.mockResolvedValue({});
    const changes = { before: { name: 'Old' }, after: { name: 'New' } };

    await audit.log({ ...PAYLOAD, action: 'UPDATE', changes });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ changes })
    );
  });

  test('does NOT throw when AuditLog.create rejects (fire-and-forget)', async () => {
    AuditLog.create.mockRejectedValue(new Error('DB down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(audit.log(PAYLOAD)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith('[AUDIT] write failed:', 'DB down');

    spy.mockRestore();
  });

  test('does NOT throw when AuditLog.create throws synchronously', async () => {
    AuditLog.create.mockImplementation(() => { throw new Error('sync boom'); });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(audit.log(PAYLOAD)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
