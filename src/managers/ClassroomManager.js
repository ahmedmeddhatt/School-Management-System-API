const Classroom = require('../models/Classroom');
const { getClient } = require('../loaders/redis');

const CACHE_TTL = parseInt(process.env.REDIS_TTL) || 300;
const listCacheKey = (schoolId) => `classrooms:${schoolId}`;

class ClassroomManager {
  async create(dto) {
    const classroom = await Classroom.create(dto);
    const redis = getClient();
    await redis.del(listCacheKey(dto.schoolId)); // invalidate list cache
    return classroom.toObject();
  }

  async listBySchool(schoolId) {
    const redis = getClient();
    const key = listCacheKey(schoolId);
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    const classrooms = await Classroom.find({ schoolId }).lean();
    await redis.setex(key, CACHE_TTL, JSON.stringify(classrooms));
    return classrooms;
  }

  async getById(id, schoolId) {
    return Classroom.findOne({ _id: id, schoolId }).lean();
  }

  async update(id, schoolId, dto) {
    const classroom = await Classroom.findOneAndUpdate(
      { _id: id, schoolId },
      dto,
      { new: true, runValidators: true }
    ).lean();

    if (classroom) {
      const redis = getClient();
      await redis.del(listCacheKey(schoolId));
    }
    return classroom;
  }

  async delete(id, schoolId) {
    const classroom = await Classroom.findOneAndDelete({ _id: id, schoolId }).lean();
    if (classroom) {
      const redis = getClient();
      await redis.del(listCacheKey(schoolId));
    }
    return classroom;
  }
}

module.exports = new ClassroomManager();
