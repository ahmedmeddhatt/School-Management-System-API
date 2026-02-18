const Redis = require('ioredis');

let client;

const connect = () => {
  client = new Redis(process.env.REDIS_URL);

  client.on('connect', () => console.log('Redis connected'));
  client.on('error', (err) => console.error('Redis error:', err));

  return client;
};

const getClient = () => {
  if (!client) throw new Error('Redis not initialized');
  return client;
};

module.exports = { connect, getClient };
