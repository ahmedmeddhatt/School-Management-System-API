const router = require('express').Router();
const classroomManager = require('../managers/ClassroomManager');
const { authenticate, authorize, ownSchoolOnly, ROLES } = require('../mws/rbac');
const validate = require('../mws/validate');
const { createClassroom, updateClassroom } = require('../mws/schemas/classroom.schema');

const ALL_ADMINS = [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN];
const actor      = (req) => req.user.userId || req.user._id;

router.use(authenticate);

router.post('/', authorize(...ALL_ADMINS), ownSchoolOnly, validate(createClassroom), async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.body.schoolId : req.user.schoolId;
    const classroom = await classroomManager.create({ ...req.body, schoolId }, actor(req));
    res.status(201).json({ ok: true, data: classroom });
  } catch (err) { next(err); }
});

router.get('/', authorize(...ALL_ADMINS), async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.query.schoolId : req.user.schoolId;
    if (!schoolId) return res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'schoolId is required' });
    const classrooms = await classroomManager.listBySchool(schoolId);
    res.json({ ok: true, data: classrooms });
  } catch (err) { next(err); }
});

router.get('/:id', authorize(...ALL_ADMINS), async (req, res, next) => {
  try {
    const schoolId = req.user.role === ROLES.SUPER_ADMIN ? req.query.schoolId : req.user.schoolId;
    const classroom = await classroomManager.getById(req.params.id, schoolId);
    if (!classroom) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Classroom not found' });
    res.json({ ok: true, data: classroom });
  } catch (err) { next(err); }
});

router.put('/:id', authorize(...ALL_ADMINS), ownSchoolOnly, validate(updateClassroom), async (req, res, next) => {
  try {
    const schoolId  = req.user.role === ROLES.SUPER_ADMIN ? req.body.schoolId : req.user.schoolId;
    const classroom = await classroomManager.update(req.params.id, schoolId, req.body, actor(req));
    if (!classroom) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Classroom not found' });
    res.json({ ok: true, data: classroom });
  } catch (err) { next(err); }
});

router.delete('/:id', authorize(...ALL_ADMINS), ownSchoolOnly, async (req, res, next) => {
  try {
    const schoolId  = req.user.role === ROLES.SUPER_ADMIN ? req.body.schoolId : req.user.schoolId;
    const classroom = await classroomManager.delete(req.params.id, schoolId, actor(req));
    if (!classroom) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Classroom not found' });
    res.json({ ok: true, message: 'Classroom soft-deleted' });
  } catch (err) { next(err); }
});

router.patch('/:id/restore', authorize(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const schoolId  = req.query.schoolId;
    const classroom = await classroomManager.restore(req.params.id, schoolId, actor(req));
    if (!classroom) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Classroom not found or not deleted' });
    res.json({ ok: true, data: classroom });
  } catch (err) { next(err); }
});

module.exports = router;
