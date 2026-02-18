const router = require('express').Router();
const schoolManager = require('../managers/SchoolManager');
const { authenticate, authorize, ROLES } = require('../mws/rbac');

// All school routes are SuperAdmin only
router.use(authenticate, authorize(ROLES.SUPER_ADMIN));

router.post('/', async (req, res, next) => {
  try {
    const school = await schoolManager.create(req.body);
    res.status(201).json(school);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const school = await schoolManager.getById(req.params.id);
    if (!school) return res.status(404).json({ error: 'School not found' });
    res.json(school);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const school = await schoolManager.update(req.params.id, req.body);
    if (!school) return res.status(404).json({ error: 'School not found' });
    res.json(school);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const school = await schoolManager.delete(req.params.id);
    if (!school) return res.status(404).json({ error: 'School not found' });
    res.json({ message: 'School deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
