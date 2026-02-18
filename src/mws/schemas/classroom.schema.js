const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

exports.createClassroom = Joi.object({
  name:     Joi.string().trim().min(1).max(100).required(),
  schoolId: objectId.optional(), // injected from JWT for SCHOOL_ADMIN
  capacity: Joi.number().integer().min(1).max(500).required(),
});

exports.updateClassroom = Joi.object({
  name:     Joi.string().trim().min(1).max(100),
  capacity: Joi.number().integer().min(1).max(500),
  schoolId: objectId.optional(),
}).min(1);
