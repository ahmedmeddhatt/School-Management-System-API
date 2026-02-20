const Joi = require('joi');

exports.register = Joi.object({
  email:    Joi.string().email().lowercase().required(),
  password: Joi.string().min(6).required(),
});

exports.login = Joi.object({
  email:    Joi.string().email().lowercase().required(),
  password: Joi.string().min(6).required(),
});

exports.createApiKey = Joi.object({
  name: Joi.string().trim().min(1).max(60).required(),
});
