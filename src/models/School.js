const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

schoolSchema.index({ adminId: 1 });

// Cursor-based pagination for SuperAdmin listing
schoolSchema.index({ _id: 1 });
schoolSchema.index({ createdAt: -1, _id: -1 });

module.exports = mongoose.model('School', schoolSchema);
