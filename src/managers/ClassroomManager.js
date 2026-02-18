const Classroom  = require('../models/Classroom');
const { getClient } = require('../loaders/redis');
const audit      = require('../libs/audit');

const CACHE_TTL    = parseInt(process.env.REDIS_TTL) || 300;
const listCacheKey = (schoolId) => `classrooms:${schoolId}`;

class ClassroomManager {
  async create(dto, actorId) {
    const classroom = await Classroom.create(dto);
    const redis = getClient();
    await redis.del(listCacheKey(dto.schoolId));

    await audit.log({
      action: 'CREATE', resourceType: 'Classroom',
      resourceId: classroom._id, performedBy: actorId, schoolId: dto.schoolId,
    });
    return classroom.toObject();
  }

  async listBySchool(schoolId) {
    const redis  = getClient();
    const key    = listCacheKey(schoolId);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const classrooms = await Classroom.find({ schoolId }).lean();
    await redis.setex(key, CACHE_TTL, JSON.stringify(classrooms));
    return classrooms;
  }

  async getById(id, schoolId) {
    return Classroom.findOne({ _id: id, schoolId }).lean();
  }

  async update(id, schoolId, dto, actorId) {
    const before    = await Classroom.findOne({ _id: id, schoolId }).lean();
    const classroom = await Classroom.findOneAndUpdate(
      { _id: id, schoolId },
      dto,
      { new: true, runValidators: true }
    ).lean();

    if (classroom) {
      const redis = getClient();
      await redis.del(listCacheKey(schoolId));

      await audit.log({
        action: 'UPDATE', resourceType: 'Classroom',
        resourceId: id, performedBy: actorId, schoolId,
        changes: { before, after: classroom },
      });
    }
    return classroom;
  }

  async delete(id, schoolId, actorId) {
    const deleted = await Classroom.softDelete(id, actorId);
    if (!deleted) return null;

    const redis = getClient();
    await redis.del(listCacheKey(schoolId));

    await audit.log({
      action: 'SOFT_DELETE', resourceType: 'Classroom',
      resourceId: id, performedBy: actorId, schoolId,
    });
    return deleted.toObject();
  }

  async restore(id, schoolId, actorId) {
    const classroom = await Classroom.restore(id);
    if (!classroom) return null;

    const redis = getClient();
    await redis.del(listCacheKey(schoolId));

    await audit.log({
      action: 'RESTORE', resourceType: 'Classroom',
      resourceId: id, performedBy: actorId, schoolId,
    });
    return classroom.toObject();
  }
}

module.exports = new ClassroomManager();
