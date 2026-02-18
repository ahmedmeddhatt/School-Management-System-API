const router = require('express').Router();
const schoolManager = require('../managers/SchoolManager');
const { authenticate, authorize, ROLES } = require('../mws/rbac');
const validate = require('../mws/validate');
const { createSchool, updateSchool } = require('../mws/schemas/school.schema');

const actor = (req) => req.user.userId || req.user._id;

router.use(authenticate, authorize(ROLES.SUPER_ADMIN));

router.post('/', validate(createSchool), async (req, res, next) => {
  try {
    const school = await schoolManager.create(req.body, actor(req));
    res.status(201).json({ ok: true, data: school });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const school = await schoolManager.getById(req.params.id);
    if (!school) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'School not found' });
    res.json({ ok: true, data: school });
  } catch (err) { next(err); }
});

router.put('/:id', validate(updateSchool), async (req, res, next) => {
  try {
    const school = await schoolManager.update(req.params.id, req.body, actor(req));
    if (!school) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'School not found' });
    res.json({ ok: true, data: school });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const school = await schoolManager.delete(req.params.id, actor(req));
    if (!school) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'School not found' });
    res.json({ ok: true, message: 'School soft-deleted' });
  } catch (err) { next(err); }
});

// PATCH /:id/restore — undo soft delete
router.patch('/:id/restore', async (req, res, next) => {
  try {
    const school = await schoolManager.restore(req.params.id, actor(req));
    if (!school) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'School not found or not deleted' });
    res.json({ ok: true, data: school });
  } catch (err) { next(err); }
});

module.exports = router;
