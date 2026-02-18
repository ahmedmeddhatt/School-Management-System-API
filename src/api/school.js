const router = require('express').Router();
const schoolManager = require('../managers/SchoolManager');
const { authenticate, authorize, ROLES } = require('../mws/rbac');
const validate = require('../mws/validate');
const { createSchool, updateSchool } = require('../mws/schemas/school.schema');

// All school routes are SuperAdmin only
router.use(authenticate, authorize(ROLES.SUPER_ADMIN));

router.post('/', validate(createSchool), async (req, res, next) => {
  try {
    const school = await schoolManager.create(req.body);
    res.status(201).json({ ok: true, data: school });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const school = await schoolManager.getById(req.params.id);
    if (!school) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'School not found' });
    res.json({ ok: true, data: school });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validate(updateSchool), async (req, res, next) => {
  try {
    const school = await schoolManager.update(req.params.id, req.body);
    if (!school) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'School not found' });
    res.json({ ok: true, data: school });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const school = await schoolManager.delete(req.params.id);
    if (!school) return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'School not found' });
    res.json({ ok: true, message: 'School deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
