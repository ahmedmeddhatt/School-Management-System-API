const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    schoolId:     { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    capacity:     { type: Number, required: true, min: 1 },
    studentCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Fast list lookup per school
classroomSchema.index({ schoolId: 1 });

// Cursor-based pagination (schoolId + _id)
classroomSchema.index({ schoolId: 1, _id: 1 });

// Time-sorted listing (newest first)
classroomSchema.index({ schoolId: 1, createdAt: -1 });

module.exports = mongoose.model('Classroom', classroomSchema);
