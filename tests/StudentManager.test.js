/**
 * Unit tests for StudentManager capacity logic.
 * All Mongoose / Redis calls are mocked — no real DB needed.
 */
jest.mock('../src/models/Student');
jest.mock('../src/models/Classroom');
jest.mock('../src/libs/audit');       // prevent real AuditLog writes
jest.mock('../src/models/AuditLog'); // guard against direct imports
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  const session = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
    inTransaction: jest.fn(() => true),
  };
  return {
    ...actual,
    startSession: jest.fn().mockResolvedValue(session),
    Types: actual.Types,
  };
});

const mongoose = require('mongoose');
const Student = require('../src/models/Student');
const Classroom = require('../src/models/Classroom');

// Re-require after mocks are set
const studentManager = require('../src/managers/StudentManager');

const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
  inTransaction: jest.fn(() => true),
};

beforeEach(() => {
  jest.clearAllMocks();
  mongoose.startSession.mockResolvedValue(mockSession);
});

const BASE_DTO = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@school.com',
  classroomId: new mongoose.Types.ObjectId().toString(),
};
const SCHOOL_ID = new mongoose.Types.ObjectId().toString();

describe('StudentManager.enroll', () => {
  test('enrolls student when classroom has capacity', async () => {
    const classroom = { _id: BASE_DTO.classroomId, studentCount: 1, capacity: 30 };
    Classroom.findOneAndUpdate.mockReturnValue({
      // simulate the chained query
      then: (resolve) => resolve(classroom),
    });

    Student.findOne.mockReturnValue({
      lean: () => ({ session: () => null }),
    });

    const studentDoc = { ...BASE_DTO, schoolId: SCHOOL_ID, toObject: () => ({ ...BASE_DTO }) };
    Student.create.mockResolvedValue([studentDoc]);

    const result = await studentManager.enroll(BASE_DTO, SCHOOL_ID);

    expect(Classroom.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        $expr: { $lt: ['$studentCount', '$capacity'] },
      }),
      { $inc: { studentCount: 1 } },
      expect.objectContaining({ session: mockSession })
    );
    expect(result).toMatchObject({ email: BASE_DTO.email });
    expect(mockSession.commitTransaction).toHaveBeenCalled();
  });

  test('throws 409 when classroom is at full capacity', async () => {
    // findOneAndUpdate returns null (capacity check failed)
    Classroom.findOneAndUpdate.mockReturnValue({
      then: (resolve) => resolve(null),
    });
    // findOne confirms classroom exists
    Classroom.findOne.mockReturnValue({ lean: () => ({ _id: BASE_DTO.classroomId }) });

    await expect(studentManager.enroll(BASE_DTO, SCHOOL_ID)).rejects.toMatchObject({
      status: 409,
      message: 'Classroom is at full capacity',
    });
    expect(mockSession.abortTransaction).toHaveBeenCalled();
    expect(mockSession.commitTransaction).not.toHaveBeenCalled();
  });

  test('throws 404 when classroom does not belong to school', async () => {
    Classroom.findOneAndUpdate.mockReturnValue({ then: (resolve) => resolve(null) });
    // findOne returns null — classroom not found for this school
    Classroom.findOne.mockReturnValue({ lean: () => null });

    await expect(studentManager.enroll(BASE_DTO, SCHOOL_ID)).rejects.toMatchObject({
      status: 404,
      message: 'Classroom not found',
    });
    expect(mockSession.abortTransaction).toHaveBeenCalled();
  });

  test('throws 409 on duplicate email within same school', async () => {
    const classroom = { _id: BASE_DTO.classroomId, studentCount: 0, capacity: 30 };
    Classroom.findOneAndUpdate.mockReturnValue({ then: (resolve) => resolve(classroom) });

    // Simulate existing student with same email
    Student.findOne.mockReturnValue({
      lean: () => ({ session: () => ({ _id: 'existing', email: BASE_DTO.email }) }),
    });

    await expect(studentManager.enroll(BASE_DTO, SCHOOL_ID)).rejects.toMatchObject({
      status: 409,
      message: 'Student already enrolled in this school',
    });
    expect(mockSession.abortTransaction).toHaveBeenCalled();
  });

  test('always calls session.endSession even on unexpected error', async () => {
    Classroom.findOneAndUpdate.mockReturnValue({
      then: () => { throw new Error('DB crash'); },
    });

    await expect(studentManager.enroll(BASE_DTO, SCHOOL_ID)).rejects.toThrow('DB crash');
    expect(mockSession.endSession).toHaveBeenCalled();
  });
});

describe('StudentManager.list (cursor pagination)', () => {
  test('returns data and nextCursor when more results exist', async () => {
    const ids = Array.from({ length: 21 }, () => new mongoose.Types.ObjectId());
    const docs = ids.map((id) => ({ _id: id, email: `s${id}@x.com` }));

    Student.find.mockReturnValue({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve(docs) }) }),
    });

    const result = await studentManager.list(SCHOOL_ID, null, 20);

    expect(result.data).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual(docs[19]._id);
  });

  test('returns hasMore false on last page', async () => {
    const docs = [{ _id: new mongoose.Types.ObjectId(), email: 'a@x.com' }];
    Student.find.mockReturnValue({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve(docs) }) }),
    });

    const result = await studentManager.list(SCHOOL_ID, null, 20);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  test('applies cursor filter when cursor is provided', async () => {
    const cursor = new mongoose.Types.ObjectId().toString();
    Student.find.mockReturnValue({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }),
    });

    await studentManager.list(SCHOOL_ID, cursor, 20);

    expect(Student.find).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $gt: expect.any(mongoose.Types.ObjectId) },
      })
    );
  });
});
