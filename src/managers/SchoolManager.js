const School = require('../models/School');
const { getClient } = require('../loaders/redis');

const CACHE_TTL = parseInt(process.env.REDIS_TTL) || 300;
const cacheKey = (id) => `school:${id}`;

class SchoolManager {
  async create(dto) {
    const school = await School.create(dto);
    return school.toObject();
  }

  async getById(id) {
    const redis = getClient();
    const cached = await redis.get(cacheKey(id));
    if (cached) return JSON.parse(cached);

    const school = await School.findById(id).lean();
    if (!school) return null;

    await redis.setex(cacheKey(id), CACHE_TTL, JSON.stringify(school));
    return school;
  }

  async update(id, dto) {
    const school = await School.findByIdAndUpdate(id, dto, { new: true, runValidators: true }).lean();
    if (!school) return null;

    const redis = getClient();
    await redis.setex(cacheKey(id), CACHE_TTL, JSON.stringify(school));
    return school;
  }

  async delete(id) {
    const school = await School.findByIdAndDelete(id).lean();
    if (!school) return null;

    const redis = getClient();
    await redis.del(cacheKey(id));
    return school;
  }
}

module.exports = new SchoolManager();
