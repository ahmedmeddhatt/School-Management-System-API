const mongoose = require('mongoose');
const Student = require('../models/Student');
const Classroom = require('../models/Classroom');

class StudentManager {
  /**
   * Enroll a student using a MongoDB transaction.
   * Atomically increments studentCount only when capacity is not reached.
   */
  async enroll(studentDTO, schoolId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { classroomId, email } = studentDTO;

      // Atomic increment — only succeeds when studentCount < capacity
      const classroom = await Classroom.findOneAndUpdate(
        {
          _id: classroomId,
          schoolId,
          $expr: { $lt: ['$studentCount', '$capacity'] },
        },
        { $inc: { studentCount: 1 } },
        { new: true, session }
      );

      if (!classroom) {
        await session.abortTransaction();
        const exists = await Classroom.findOne({ _id: classroomId, schoolId }).lean();
        const error = new Error(exists ? 'Classroom is at full capacity' : 'Classroom not found');
        error.status = exists ? 409 : 404;
        throw error;
      }

      // Check duplicate enrollment
      const duplicate = await Student.findOne({ schoolId, email }).lean().session(session);
      if (duplicate) {
        await session.abortTransaction();
        const error = new Error('Student already enrolled in this school');
        error.status = 409;
        throw error;
      }

      const [student] = await Student.create(
        [{ ...studentDTO, schoolId, classroomId }],
        { session }
      );

      await session.commitTransaction();
      return student.toObject();
    } catch (err) {
      // Only abort if still active (not already aborted above)
      if (session.inTransaction()) await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Cursor-based pagination using _id.
   * @param {string} schoolId
   * @param {string|null} cursor - last _id from previous page
   * @param {number} limit
   */
  async list(schoolId, cursor = null, limit = 20) {
    const filter = { schoolId };
    if (cursor) filter._id = { $gt: new mongoose.Types.ObjectId(cursor) };

    const students = await Student.find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .lean();

    const hasMore = students.length > limit;
    const data = hasMore ? students.slice(0, limit) : students;
    const nextCursor = hasMore ? data[data.length - 1]._id : null;

    return { data, nextCursor, hasMore };
  }

  async getById(id, schoolId) {
    return Student.findOne({ _id: id, schoolId }).lean();
  }

  async remove(id, schoolId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const student = await Student.findOneAndDelete({ _id: id, schoolId }, { session });
      if (!student) {
        await session.abortTransaction();
        return null;
      }

      await Classroom.findByIdAndUpdate(
        student.classroomId,
        { $inc: { studentCount: -1 } },
        { session }
      );

      await session.commitTransaction();
      return student.toObject();
    } catch (err) {
      if (session.inTransaction()) await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new StudentManager();
