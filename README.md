<div align="center">

```
 ____  ____  _  _  ___  ___  __       __  __  ___  _  _
/ ___||  __|| || || __|/ _ \| |      |  \/  |/ __|| \| |
\___ \| |__ | __ || _|| (_) | |__    | |\/| | (_ ||  . |
|____/|____||_||_||___|\___/|____|   |_|  |_|\___||_|\_|

        🏫  School Management API  🏫
```

![Node](https://img.shields.io/badge/Node.js-20-green?logo=node.js)
![Express](https://img.shields.io/badge/Express-4-black?logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_8-brightgreen?logo=mongodb)
![Redis](https://img.shields.io/badge/Redis-ioredis-red?logo=redis)
![Tests](https://img.shields.io/badge/Tests-66%20passing-success?logo=jest)
![License](https://img.shields.io/badge/License-MIT-blue)

> **Production-ready REST API** for managing Schools, Classrooms & Students —
> built with atomic concurrency guards, Redis caching, soft deletes, MFA, and API keys.

</div>

---

## 📦 Tech Stack

| Layer | Tech |
|-------|------|
| 🌐 Server | Node.js 20 + Express 4 |
| 🗄️ Database | MongoDB + Mongoose 8 |
| ⚡ Cache | Redis (ioredis) |
| 🔐 Auth | JWT + TOTP MFA (speakeasy) + API Keys |
| 🧪 Tests | Jest (66 tests, 0 failures) |
| ✅ Validation | Joi schemas |

---

## 🏗️ Project Structure

```
school/
├── 📁 src/
│   ├── 📁 api/            ← Express routers
│   │   ├── auth.js        (login, MFA, API keys)
│   │   ├── school.js      (SUPER_ADMIN only)
│   │   ├── classroom.js   (both roles)
│   │   └── student.js     (enroll, paginate, remove)
│   │
│   ├── 📁 managers/       ← Business logic layer
│   │   ├── AuthManager.js
│   │   ├── SchoolManager.js
│   │   ├── ClassroomManager.js
│   │   └── StudentManager.js
│   │
│   ├── 📁 models/         ← Mongoose schemas
│   │   ├── User.js        (MFA + API keys)
│   │   ├── School.js
│   │   ├── Classroom.js   (studentCount for O(1) capacity)
│   │   ├── Student.js
│   │   └── AuditLog.js
│   │
│   ├── 📁 mws/            ← Middleware
│   │   ├── rbac.js        (authenticate + authorize + ownSchoolOnly)
│   │   ├── validate.js    (Joi factory)
│   │   ├── errorHandler.js
│   │   └── 📁 schemas/    (Joi schemas per entity)
│   │
│   ├── 📁 loaders/        ← Startup wiring
│   │   ├── express.js
│   │   ├── mongoose.js
│   │   └── redis.js
│   │
│   └── 📁 libs/           ← Shared utilities
│       ├── AppError.js    (operational errors)
│       ├── audit.js       (fire-and-forget logger)
│       └── softDelete.plugin.js
│
├── 📁 tests/
│   ├── 📁 unit/           ← Pure logic, no DB
│   ├── 📁 integration/    ← Mocked DB/Redis
│   ├── 📁 stress/         ← Concurrency scripts
│   └── StudentManager.test.js
│
├── .env.example
└── package.json
```

---

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone https://github.com/ahmedmeddhatt/School-Management-System-API.git
cd School-Management-System-API
npm install

# 2. Configure environment
cp .env.example .env
# Fill in MONGO_URI, REDIS_URL, JWT_SECRET

# 3. Start (dev mode with hot reload)
npm run dev

# 4. Run tests
npm test
```

---

## 🔑 Authentication

The API supports **two auth schemes** side-by-side:

```
Authorization: Bearer <jwt>       ← Standard JWT login
Authorization: ApiKey <raw-key>   ← Programmatic / CI access
```

### Login Flow

```
POST /auth/login
  ├── No MFA  →  { token: "jwt..." }         ✅ done
  └── MFA on  →  { mfaRequired: true, preToken: "..." }
                      │
                      ▼
              POST /auth/mfa/validate
                  { preToken, totpToken }
                      │
                      ▼
                  { token: "jwt..." }         ✅ done
```

### MFA Setup Flow

```
POST /auth/mfa/setup      → { secret, qrDataUrl }
    ↓  (scan QR in app)
POST /auth/mfa/activate   → { mfaEnabled: true }
    ↓
🎉 All future logins require TOTP code
```

### API Keys

```
POST   /auth/api-keys          → { key: "abc123..." }  ← shown ONCE
GET    /auth/api-keys          → [{ _id, name, lastUsed }]
DELETE /auth/api-keys/:keyId   → revoked
```

> ⚠️ Only the **SHA-256 hash** is stored. Raw key is never persisted.

---

## 👮 Role-Based Access Control

```
┌─────────────────┬──────────┬──────────────────────────────────┐
│ Resource        │ Role     │ Restriction                      │
├─────────────────┼──────────┼──────────────────────────────────┤
│ POST /schools   │ SUPER    │ Unrestricted                     │
│ GET /schools    │ SUPER    │ Unrestricted                     │
│ PUT /schools    │ SUPER    │ Unrestricted                     │
│ DELETE /schools │ SUPER    │ Unrestricted (soft delete)       │
├─────────────────┼──────────┼──────────────────────────────────┤
│ /classrooms     │ BOTH     │ SCHOOL_ADMIN → own school only   │
│ /students       │ BOTH     │ SCHOOL_ADMIN → own school only   │
└─────────────────┴──────────┴──────────────────────────────────┘
```

The `ownSchoolOnly` middleware **hard-blocks** cross-tenant access:

```js
// SCHOOL_ADMIN with schoolId "A" hitting resource of school "B" → 403
Authorization: Bearer <school_admin_A_token>
POST /api/classrooms  { schoolId: "B", ... }
                          ↓
                    403 Forbidden ❌
```

---

## ⚡ Concurrency & Capacity Guard

The enrollment uses **atomic MongoDB operations** — no race conditions:

```
20 simultaneous POST /api/students/enroll requests
         ↓
Classroom.findOneAndUpdate({
  _id: classroomId,
  $expr: { $lt: ["$studentCount", "$capacity"] },  ← guard
}, { $inc: { studentCount: 1 } })                  ← atomic
         ↓
✅  5 requests succeed  →  201 Created
❌ 15 requests fail     →  409 Conflict
```

> Run the stress test: `CAPACITY=5 CONCURRENCY=20 node tests/stress/enrollment-stress.js`

---

## 🗑️ Soft Deletes + Audit Trail

Nothing is ever truly deleted. Every mutation is logged.

```
DELETE /api/schools/:id
    ↓
School.softDelete(id, actorId)    ← sets deletedAt = now
    ↓
redis.del(cacheKey)               ← cache invalidated
    ↓
AuditLog.create({                 ← immutable record
  action: "SOFT_DELETE",
  resourceType: "School",
  performedBy: actorId,
  createdAt: now
})

# Restore later:
PATCH /api/schools/:id/restore    → 200 OK
```

### Audit Log Schema

```
{
  action:       CREATE | UPDATE | SOFT_DELETE | RESTORE
  resourceType: School | Classroom | Student
  resourceId:   ObjectId
  performedBy:  ObjectId (User)
  schoolId:     ObjectId
  changes:      { before: {...}, after: {...} }   ← on UPDATE
  createdAt:    Date (auto)
}
```

---

## 🏎️ Redis Caching Strategy

```
GET /api/schools/:id
  ├── Cache HIT  → return JSON (TTL: 300s)  ⚡ ~0ms
  └── Cache MISS → MongoDB → store → return  🐢 ~10ms

Mutation (PUT/DELETE):
  → DB update → redis.setex / redis.del     ♻️ no stale data
```

| Cache Key | TTL | Invalidated On |
|-----------|-----|----------------|
| `school:{id}` | 300s | PUT, DELETE |
| `classrooms:{schoolId}` | 300s | POST, PUT, DELETE classroom |

---

## 📄 API Reference

### 🔐 Auth  `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/login` | — | Login with email + password |
| `POST` | `/auth/mfa/setup` | JWT | Generate TOTP secret + QR |
| `POST` | `/auth/mfa/activate` | JWT | Enable MFA after first verify |
| `POST` | `/auth/mfa/validate` | — | Validate TOTP during login |
| `GET` | `/auth/api-keys` | JWT | List API keys (no hash) |
| `POST` | `/auth/api-keys` | JWT | Create API key |
| `DELETE` | `/auth/api-keys/:id` | JWT | Revoke API key |

### 🏫 Schools  `/api/schools`  *(SUPER_ADMIN)*

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/schools` | Create school |
| `GET` | `/api/schools/:id` | Get school (cached) |
| `PUT` | `/api/schools/:id` | Update school |
| `DELETE` | `/api/schools/:id` | Soft-delete school |
| `PATCH` | `/api/schools/:id/restore` | Restore school |

### 🚪 Classrooms  `/api/classrooms`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/classrooms` | Create classroom |
| `GET` | `/api/classrooms` | List classrooms (cached) |
| `GET` | `/api/classrooms/:id` | Get classroom |
| `PUT` | `/api/classrooms/:id` | Update classroom |
| `DELETE` | `/api/classrooms/:id` | Soft-delete classroom |
| `PATCH` | `/api/classrooms/:id/restore` | Restore *(SUPER_ADMIN)* |

### 🎓 Students  `/api/students`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/students/enroll` | Enroll student (transaction) |
| `GET` | `/api/students?cursor=&limit=` | Paginated list |
| `GET` | `/api/students/:id` | Get student |
| `DELETE` | `/api/students/:id` | Soft-delete + decrement count |

---

## 📊 Response Envelope

Every response uses a consistent shape:

```json
// ✅ Success
{ "ok": true, "data": { ... } }

// ✅ Paginated
{ "ok": true, "data": [...], "nextCursor": "abc123", "hasMore": true }

// ❌ Error
{ "ok": false, "code": "VALIDATION_ERROR", "message": "...", "details": [...] }
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `201` | Created |
| `400` | Bad request / validation failed |
| `401` | Missing / invalid token |
| `403` | Forbidden (wrong role or school) |
| `404` | Not found |
| `409` | Conflict (duplicate / capacity full) |
| `500` | Internal server error |

---

## 🗺️ Entity Relationships

```
User ──────────────────────────────────────────┐
 │                                             │
 │ adminId                                     │ performedBy
 ▼                                             ▼
School ──────── AuditLog (CREATE/UPDATE/DELETE/RESTORE)
  │
  │ 1:N
  ▼
Classroom  (capacity, studentCount)
  │
  │ 1:N
  ▼
Student  (schoolId + email = unique per school)
```

### Compound Indexes

```js
// Student — no duplicate emails per school
{ schoolId: 1, email: 1 }  unique: true

// Student — cursor pagination
{ schoolId: 1, _id: 1 }

// Classroom — cursor pagination + time sort
{ schoolId: 1, _id: 1 }
{ schoolId: 1, createdAt: -1 }

// AuditLog — resource history
{ resourceType: 1, resourceId: 1, createdAt: -1 }
{ schoolId: 1, createdAt: -1 }
```

---

## 🧪 Test Coverage

```
tests/
├── unit/
│   ├── softDelete.plugin.test.js   12 tests  ✅
│   ├── audit.test.js                4 tests  ✅
│   ├── rbac.authenticate.test.js    9 tests  ✅
│   └── authManager.test.js         18 tests  ✅
├── integration/
│   ├── crossTenant.test.js          7 tests  ✅
│   └── cacheInvalidation.test.js    8 tests  ✅
├── StudentManager.test.js           8 tests  ✅
└── stress/
    └── enrollment-stress.js        (live server)

Total: 66 tests — 0 failures 🎉
```

### What's Tested

| Feature | Test |
|---------|------|
| Capacity atomic guard | 20 concurrent requests → exactly 5 succeed |
| Cross-tenant block | SCHOOL_ADMIN + foreign schoolId → 403 |
| Cache invalidation | GET→UPDATE→GET returns fresh data, no stale |
| Soft delete filter | `find()` auto-injects `{ deletedAt: null }` |
| API key hash | Raw key never stored; SHA-256 only |
| MFA gate | Login returns `preToken` when MFA enabled |
| Session cleanup | `endSession()` always called, even on crash |

---

## ⚙️ Environment Variables

```bash
PORT=3000
MONGO_URI=mongodb://localhost:27017/school_management
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d
REDIS_TTL=300
```

---

## 🛠️ Scripts

```bash
npm start      # production
npm run dev    # nodemon hot-reload
npm test       # jest --forceExit
node tests/stress/enrollment-stress.js  # concurrency test (needs live server)
```

---

<div align="center">

Built with ❤️ on the [qantra-io/axion](https://github.com/qantra-io/axion) template pattern.

</div>
