const router = require('express').Router();
const studentManager = require('../managers/StudentManager');
const { authenticate, authorize, ROLES } = require('../mws/rbac');

const ALL_ADMINS = [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN];

router.use(authenticate, authorize(...ALL_ADMINS));

// POST /api/students/enroll
router.post('/enroll', async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.body.schoolId : req.user.schoolId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const student = await studentManager.enroll(req.body, schoolId);
    res.status(201).json(student);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/students?cursor=<id>&limit=<n>
router.get('/', async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.query.schoolId : req.user.schoolId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const result = await studentManager.list(schoolId, req.query.cursor || null, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/students/:id
router.get('/:id', async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.query.schoolId : req.user.schoolId;
    const student = await studentManager.getById(req.params.id, schoolId);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/students/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.body.schoolId : req.user.schoolId;
    const student = await studentManager.remove(req.params.id, schoolId);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Student removed', student });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
