/**
 * Concurrency Stress Test — Enrollment Capacity
 *
 * Sends CONCURRENCY simultaneous enrollment requests to a live server.
 * Expected: exactly CAPACITY succeed (201), the rest fail (409).
 *
 * Usage:
 *   SUPER_ADMIN_TOKEN=<jwt> SCHOOL_ID=<id> CLASSROOM_ID=<id> node tests/stress/enrollment-stress.js
 *
 * Environment variables:
 *   API_URL           default: http://localhost:3000
 *   SUPER_ADMIN_TOKEN JWT signed with role SUPER_ADMIN  (required)
 *   SCHOOL_ID         ObjectId of the target school      (required)
 *   CLASSROOM_ID      ObjectId of a classroom with capacity=CAPACITY (required)
 *   CAPACITY          Must match the classroom's capacity field (default: 5)
 *   CONCURRENCY       Number of simultaneous requests    (default: 20)
 */

const BASE_URL    = process.env.API_URL        || 'http://localhost:3000';
const TOKEN       = process.env.SUPER_ADMIN_TOKEN;
const SCHOOL_ID   = process.env.SCHOOL_ID;
const CLASSROOM_ID = process.env.CLASSROOM_ID;
const CAPACITY    = parseInt(process.env.CAPACITY)    || 5;
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 20;

if (!TOKEN || !SCHOOL_ID || !CLASSROOM_ID) {
  console.error('Missing required env vars: SUPER_ADMIN_TOKEN, SCHOOL_ID, CLASSROOM_ID');
  process.exit(1);
}

const enroll = async (i) => {
  try {
    const res = await fetch(`${BASE_URL}/api/students/enroll`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        firstName:   'Stress',
        lastName:    `User${i}`,
        email:       `stress.user.${i}.${Date.now()}@test.com`,
        classroomId: CLASSROOM_ID,
        schoolId:    SCHOOL_ID,
      }),
    });
    const body = await res.json();
    return { index: i, status: res.status, body };
  } catch (err) {
    return { index: i, status: 0, error: err.message };
  }
};

(async () => {
  console.log('='.repeat(55));
  console.log(`Enrollment Stress Test`);
  console.log(`  Classroom capacity : ${CAPACITY}`);
  console.log(`  Concurrent requests: ${CONCURRENCY}`);
  console.log('='.repeat(55));

  const start   = Date.now();
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => enroll(i))
  );
  const elapsed = Date.now() - start;

  const created  = results.filter((r) => r.status === 201);
  const conflict = results.filter((r) => r.status === 409);
  const other    = results.filter((r) => r.status !== 201 && r.status !== 409);

  console.log(`\nResults (${elapsed}ms):`);
  console.log(`  201 Created  : ${created.length}  (expected ${CAPACITY})`);
  console.log(`  409 Conflict : ${conflict.length}  (expected ${CONCURRENCY - CAPACITY})`);
  if (other.length) {
    console.log(`  Other        :`, other.map((r) => `[${r.status}] ${r.error || ''}`));
  }

  const pass =
    created.length  === CAPACITY &&
    conflict.length === CONCURRENCY - CAPACITY;

  console.log(`\n  Test ${pass ? 'PASSED ✓' : 'FAILED ✗'}`);
  console.log('  Verify DB: db.classrooms.findOne({_id: ObjectId("' + CLASSROOM_ID + '")}).studentCount should be ' + CAPACITY);
  console.log('='.repeat(55));

  process.exit(pass ? 0 : 1);
})();
