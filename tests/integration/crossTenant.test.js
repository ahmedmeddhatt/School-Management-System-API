/**
 * Cross-Tenant Security Tests
 *
 * Verifies that ownSchoolOnly middleware blocks SCHOOL_ADMIN from
 * accessing or mutating resources belonging to a different school.
 *
 * These are pure unit tests — no DB or HTTP server required.
 */

const { ownSchoolOnly, ROLES } = require('../../src/mws/rbac');

const SCHOOL_A = '507f1f77bcf86cd799439011';
const SCHOOL_B = '507f1f77bcf86cd799439022';

const makeRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res); // allow chaining
  return res;
};

describe('ownSchoolOnly — cross-tenant security', () => {
  let next;

  beforeEach(() => {
    next = jest.fn();
  });

  // ── SUPER_ADMIN ───────────────────────────────────────────────────────────
  test('SUPER_ADMIN always passes through', () => {
    const req = { user: { role: ROLES.SUPER_ADMIN }, params: {}, body: {}, query: {} };
    ownSchoolOnly(req, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  // ── SCHOOL_ADMIN: allowed cases ───────────────────────────────────────────
  test('SCHOOL_ADMIN passes when params.schoolId matches own school', () => {
    const req = {
      user:   { role: ROLES.SCHOOL_ADMIN, schoolId: SCHOOL_A },
      params: { schoolId: SCHOOL_A },
      body:   {},
      query:  {},
    };
    ownSchoolOnly(req, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('SCHOOL_ADMIN passes when body.schoolId matches own school', () => {
    const req = {
      user:   { role: ROLES.SCHOOL_ADMIN, schoolId: SCHOOL_A },
      params: {},
      body:   { schoolId: SCHOOL_A },
      query:  {},
    };
    ownSchoolOnly(req, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  // ── SCHOOL_ADMIN: blocked cases (cross-tenant) ────────────────────────────
  test('SCHOOL_ADMIN is blocked when params.schoolId is a different school', () => {
    const req = {
      user:   { role: ROLES.SCHOOL_ADMIN, schoolId: SCHOOL_A },
      params: { schoolId: SCHOOL_B },   // ← School B in URL
      body:   {},
      query:  {},
    };
    const res = makeRes();
    ownSchoolOnly(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('SCHOOL_ADMIN is blocked when body.schoolId is a different school', () => {
    const req = {
      user:   { role: ROLES.SCHOOL_ADMIN, schoolId: SCHOOL_A },
      params: {},
      body:   { schoolId: SCHOOL_B },   // ← School B injected in body
      query:  {},
    };
    const res = makeRes();
    ownSchoolOnly(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('SCHOOL_ADMIN is blocked when params.id (school resource) is a different school', () => {
    // Case: DELETE /schools/:id where :id is another school
    const req = {
      user:   { role: ROLES.SCHOOL_ADMIN, schoolId: SCHOOL_A },
      params: { id: SCHOOL_B },         // ← School B as resource id
      body:   {},
      query:  {},
    };
    const res = makeRes();
    ownSchoolOnly(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('SCHOOL_ADMIN is blocked when no schoolId is present at all', () => {
    const req = {
      user:   { role: ROLES.SCHOOL_ADMIN, schoolId: SCHOOL_A },
      params: {},
      body:   {},
      query:  {},
    };
    const res = makeRes();
    ownSchoolOnly(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
