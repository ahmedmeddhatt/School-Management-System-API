const AuditLog = require('../models/AuditLog');

/**
 * Fire-and-forget audit log writer.
 * Never throws — audit failure must not break business operations.
 */
const log = async ({ action, resourceType, resourceId, performedBy, schoolId, changes }) => {
  try {
    await AuditLog.create({ action, resourceType, resourceId, performedBy, schoolId, changes });
  } catch (err) {
    console.error('[AUDIT] write failed:', err.message);
  }
};

module.exports = { log };
