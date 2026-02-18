const router = require('express').Router();
const studentManager = require('../managers/StudentManager');
const { authenticate, authorize, ROLES } = require('../mws/rbac');
const validate = require('../mws/validate');
const { enrollStudent } = require('../mws/schemas/student.schema');

const ALL_ADMINS = [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN];
const actor      = (req) => req.user.userId || req.user._id;

router.use(authenticate, authorize(...ALL_ADMINS));

// POST /api/students/enroll
router.post('/enroll', validate(enrollStudent), async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.body.schoolId : req.user.schoolId;
    if (!schoolId) return res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'schoolId is required' });

    const student = await studentManager.enroll(req.body, schoolId, actor(req));
    res.status(201).json({ ok: true, data: student });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, code: 'ENROLL_ERROR', message: err.message });
    next(err);
  }
});

// GET /api/students?cursor=<id>&limit=<n>
router.get('/', async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.query.schoolId : req.user.schoolId;
    if (!schoolId) return res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'schoolId is required' });

    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const result = await studentManager.list(schoolId, req.query.cursor || null, limit);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// GET /api/students/:id
router.get('/:id', async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.query.schoolId : req.user.schoolId;
    const student = await studentManager.getById(req.params.id, schoolId);
    if (!student) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Student not found' });
    res.json({ ok: true, data: student });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/students/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.body.schoolId : req.user.schoolId;
    const student = await studentManager.remove(req.params.id, schoolId, actor(req));
    if (!student) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Student not found' });
    res.json({ ok: true, message: 'Student removed', data: student });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
