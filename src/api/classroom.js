const router = require('express').Router();
const classroomManager = require('../managers/ClassroomManager');
const { authenticate, authorize, ownSchoolOnly, ROLES } = require('../mws/rbac');

const ALL_ADMINS = [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN];

router.use(authenticate);

router.post('/', authorize(...ALL_ADMINS), ownSchoolOnly, async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.body.schoolId : req.user.schoolId;
    const classroom = await classroomManager.create({ ...req.body, schoolId });
    res.status(201).json(classroom);
  } catch (err) {
    next(err);
  }
});

router.get('/', authorize(...ALL_ADMINS), async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.query.schoolId : req.user.schoolId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const classrooms = await classroomManager.listBySchool(schoolId);
    res.json(classrooms);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authorize(...ALL_ADMINS), async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.query.schoolId : req.user.schoolId;
    const classroom = await classroomManager.getById(req.params.id, schoolId);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    res.json(classroom);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authorize(...ALL_ADMINS), ownSchoolOnly, async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.body.schoolId : req.user.schoolId;
    const classroom = await classroomManager.update(req.params.id, schoolId, req.body);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    res.json(classroom);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authorize(...ALL_ADMINS), ownSchoolOnly, async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.body.schoolId : req.user.schoolId;
    const classroom = await classroomManager.delete(req.params.id, schoolId);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    res.json({ message: 'Classroom deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
