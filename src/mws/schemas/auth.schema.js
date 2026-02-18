const Joi = require('joi');

exports.login = Joi.object({
  email:    Joi.string().email().lowercase().required(),
  password: Joi.string().min(6).required(),
});

exports.mfaActivate = Joi.object({
  token: Joi.string().length(6).pattern(/^\d+$/).required(),
});

exports.mfaValidate = Joi.object({
  preToken:  Joi.string().required(),
  totpToken: Joi.string().length(6).pattern(/^\d+$/).required(),
});

exports.createApiKey = Joi.object({
  name: Joi.string().trim().min(1).max(60).required(),
});
