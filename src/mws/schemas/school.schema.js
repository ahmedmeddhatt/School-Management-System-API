const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

exports.createSchool = Joi.object({
  name:    Joi.string().trim().min(2).max(100).required(),
  address: Joi.string().trim().min(5).max(200).required(),
  adminId: objectId.required(),
});

exports.updateSchool = Joi.object({
  name:    Joi.string().trim().min(2).max(100),
  address: Joi.string().trim().min(5).max(200),
}).min(1);
