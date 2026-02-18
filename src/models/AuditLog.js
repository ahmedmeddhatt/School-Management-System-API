const mongoose = require('mongoose');

const ACTIONS = ['CREATE', 'UPDATE', 'SOFT_DELETE', 'RESTORE'];

const auditLogSchema = new mongoose.Schema(
  {
    action:       { type: String, enum: ACTIONS,              required: true },
    resourceType: { type: String, enum: ['School', 'Classroom', 'Student'], required: true },
    resourceId:   { type: mongoose.Schema.Types.ObjectId,    required: true },
    performedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    schoolId:     { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    changes:      { type: mongoose.Schema.Types.Mixed },   // { before, after } snapshot
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Query patterns
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ schoolId: 1,     createdAt: -1 });
auditLogSchema.index({ performedBy: 1,  createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
