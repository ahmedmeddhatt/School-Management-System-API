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

// Index for fast classroom list lookup per school
classroomSchema.index({ schoolId: 1 });

module.exports = mongoose.model('Classroom', classroomSchema);
