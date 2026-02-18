const School    = require('../models/School');
const { getClient } = require('../loaders/redis');
const audit     = require('../libs/audit');

const CACHE_TTL = parseInt(process.env.REDIS_TTL) || 300;
const cacheKey  = (id) => `school:${id}`;

class SchoolManager {
  async create(dto, actorId) {
    const school = await School.create(dto);
    await audit.log({
      action: 'CREATE', resourceType: 'School',
      resourceId: school._id, performedBy: actorId, schoolId: school._id,
    });
    return school.toObject();
  }

  async getById(id) {
    const redis  = getClient();
    const cached = await redis.get(cacheKey(id));
    if (cached) return JSON.parse(cached);

    const school = await School.findById(id).lean();
    if (!school) return null;

    await redis.setex(cacheKey(id), CACHE_TTL, JSON.stringify(school));
    return school;
  }

  async update(id, dto, actorId) {
    const before = await School.findById(id).lean();
    const school = await School.findByIdAndUpdate(id, dto, { new: true, runValidators: true }).lean();
    if (!school) return null;

    const redis = getClient();
    await redis.setex(cacheKey(id), CACHE_TTL, JSON.stringify(school));

    await audit.log({
      action: 'UPDATE', resourceType: 'School',
      resourceId: id, performedBy: actorId, schoolId: id,
      changes: { before, after: school },
    });
    return school;
  }

  async delete(id, actorId) {
    const deleted = await School.softDelete(id, actorId);
    if (!deleted) return null;

    const redis = getClient();
    await redis.del(cacheKey(id));

    await audit.log({
      action: 'SOFT_DELETE', resourceType: 'School',
      resourceId: id, performedBy: actorId, schoolId: id,
    });
    return deleted.toObject();
  }

  async restore(id, actorId) {
    const school = await School.restore(id);
    if (!school) return null;

    const redis = getClient();
    await redis.del(cacheKey(id)); // force fresh fetch next GET

    await audit.log({
      action: 'RESTORE', resourceType: 'School',
      resourceId: id, performedBy: actorId, schoolId: id,
    });
    return school.toObject();
  }
}

module.exports = new SchoolManager();
