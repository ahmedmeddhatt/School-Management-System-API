require('dotenv').config();
const express = require('express');
const connectMongo = require('./loaders/mongoose');
const { connect: connectRedis } = require('./loaders/redis');
const loadExpress = require('./loaders/express');

const app = express();

let ready = false;
const init = (async () => {
  await connectMongo();
  connectRedis();
  loadExpress(app);
  ready = true;
})();

// Ensure connections are up before first request
app.use(async (_req, _res, next) => {
  if (!ready) await init;
  next();
});

module.exports = app;
