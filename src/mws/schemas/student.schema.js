const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

exports.enrollStudent = Joi.object({
  firstName:   Joi.string().trim().min(1).max(50).required(),
  lastName:    Joi.string().trim().min(1).max(50).required(),
  email:       Joi.string().trim().email().lowercase().required(),
  classroomId: objectId.required(),
  schoolId:    objectId.optional(), // SUPER_ADMIN only; ignored for SCHOOL_ADMIN
});
