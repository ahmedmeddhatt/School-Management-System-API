require('dotenv').config();
const express = require('express');
const connectMongo = require('./loaders/mongoose');
const { connect: connectRedis } = require('./loaders/redis');
const loadExpress = require('./loaders/express');

const app = express();

(async () => {
  await connectMongo();
  connectRedis();
  loadExpress(app);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();
