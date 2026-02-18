const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    firstName:   { type: String, required: true, trim: true },
    lastName:    { type: String, required: true, trim: true },
    email:       { type: String, required: true, trim: true, lowercase: true },
    schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'School',    required: true },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  },
  { timestamps: true }
);

// Compound unique index: one email per school
studentSchema.index({ schoolId: 1, email: 1 }, { unique: true });

// Cursor-based pagination support
studentSchema.index({ schoolId: 1, _id: 1 });

module.exports = mongoose.model('Student', studentSchema);
