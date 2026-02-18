const mongoose  = require('mongoose');
const Student   = require('../models/Student');
const Classroom = require('../models/Classroom');
const audit     = require('../libs/audit');

class StudentManager {
  /**
   * Enroll a student using a MongoDB transaction.
   * Atomically increments studentCount only when capacity is not reached.
   */
  async enroll(studentDTO, schoolId, actorId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { classroomId, email } = studentDTO;

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
        const error  = new Error(exists ? 'Classroom is at full capacity' : 'Classroom not found');
        error.status = exists ? 409 : 404;
        throw error;
      }

      const duplicate = await Student.findOne({ schoolId, email }).lean().session(session);
      if (duplicate) {
        await session.abortTransaction();
        const error  = new Error('Student already enrolled in this school');
        error.status = 409;
        throw error;
      }

      const [student] = await Student.create(
        [{ ...studentDTO, schoolId, classroomId }],
        { session }
      );

      await session.commitTransaction();

      await audit.log({
        action: 'CREATE', resourceType: 'Student',
        resourceId: student._id, performedBy: actorId, schoolId,
      });

      return student.toObject();
    } catch (err) {
      if (session.inTransaction()) await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async list(schoolId, cursor = null, limit = 20) {
    const filter = { schoolId };
    if (cursor) filter._id = { $gt: new mongoose.Types.ObjectId(cursor) };

    const students = await Student.find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .lean();

    const hasMore   = students.length > limit;
    const data      = hasMore ? students.slice(0, limit) : students;
    const nextCursor = hasMore ? data[data.length - 1]._id : null;

    return { data, nextCursor, hasMore };
  }

  async getById(id, schoolId) {
    return Student.findOne({ _id: id, schoolId }).lean();
  }

  async remove(id, schoolId, actorId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Soft-delete inside transaction: set deletedAt atomically
      const student = await Student.findOneAndUpdate(
        { _id: id, schoolId },
        { $set: { deletedAt: new Date(), deletedBy: actorId ?? null } },
        { new: false, session }   // return the doc BEFORE update
      );

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

      await audit.log({
        action: 'SOFT_DELETE', resourceType: 'Student',
        resourceId: id, performedBy: actorId, schoolId,
      });

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
