# API Reference — Request / Response Contracts

> Endpoint-by-endpoint contract reference for building frontend models and API clients.
> For auth flow, CORS, roles and high-level workflows see [`FRONTEND_INTEGRATION.md`](./FRONTEND_INTEGRATION.md).

- **Base URL (dev):** `http://localhost:3000` · **Prefix:** `/api`
- **Auth:** HttpOnly cookie `auth_token`. Send every request with credentials (`fetch` → `credentials: "include"`, `axios` → `withCredentials: true`).
- **Content type:** `application/json`. All ids are **integers**. Dates are ISO 8601 strings.
- **Error body (all errors):** `{ "error": "message" }`

Access legend: 🔓 public · 🔑 authenticated. Roles: **A**=Admin(1) · **T**=Teacher(2) · **S**=Student(3).

---

## Shared models

```ts
// Wrapper for every paginated list endpoint
interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// Standard query params for list endpoints
// ?page=<int, default 1>&limit=<int, default 10 (20 for notifications & ml-dataset)>

interface ErrorResponse { error: string }
```

---

## 1. Auth — `/api/auth`

### `POST /api/auth/login` 🔓
Request:
```json
{ "email": "user@example.com", "password": "Passw0rd" }
```
Response `200` — also sets `Set-Cookie: auth_token=...; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`:
```json
{
  "user": {
    "id": 5,
    "email": "user@example.com",
    "name": "Jane Doe",
    "birthDate": "2010-05-01T00:00:00.000Z",
    "createdAt": "2026-06-01T12:00:00.000Z",
    "updatedAt": "2026-06-01T12:00:00.000Z",
    "phoneNumber": "+593987654321",
    "isActive": true,
    "roleId": 3,
    "academicGradeId": 2,
    "school": { "id": 1, "name": "I.E. San Martín" },
    "deletedAt": null
  }
}
```
Errors: `400` invalid credentials / validation · `401` inactive account — pending teacher: `"Account is inactive. Your teacher account is pending administrator approval."`; any other inactive account: `"Account is inactive. Contact an administrator."` (always prefixed `Account is inactive`).

```ts
interface PublicUser {
  id: number;
  email: string;
  name: string;
  birthDate: string;
  createdAt: string;
  updatedAt: string;
  phoneNumber: string | null;
  isActive: boolean;
  roleId: number | null;
  academicGradeId: number | null;
  // The bare schoolId is replaced by a resolved school object (null if none).
  school: { id: number; name: string | null } | null;
  deletedAt: string | null;
}
interface LoginResponse { user: PublicUser }   // token is in the cookie, not here
```

> The `school` object (id + name) appears on the `login` and `me` responses. Other user endpoints (`/api/users/*`) still return the raw `schoolId`.

### `POST /api/auth/logout` 🔓
Request: no body. Clears the cookie.
Response `200`:
```json
{ "ok": true }
```

### `GET /api/auth/me` 🔑
Validates the current session: verifies the cookie JWT, then re-checks the user still exists and is active. Call on app load to know if the user is logged in.
Request: no body (cookie only).
Response `200`: `{ user: PublicUser }` (same shape as login).
Errors: `401` no/invalid cookie (`"Invalid session"`), or inactive account (same messages as login).

### `POST /api/auth/register` 🔓
Request (`phoneNumber`, `academicGradeId` optional/nullable; **`schoolId` required** — students and teachers always belong to a school):
```json
{
  "email": "student@example.com",
  "password": "Passw0rd",
  "name": "Jane Doe",
  "birthDate": "2010-05-01",
  "roleId": 3,
  "phoneNumber": "+593987654321",
  "schoolId": 1,
  "academicGradeId": 2
}
```
Response `201` — student (`roleId=3`, active immediately):
```json
{ "message": "User created successfully", "requiresApproval": false }
```
Response `201` — teacher (`roleId=2`, pending admin approval):
```json
{ "message": "User created successfully. Your teacher account is pending administrator approval.", "requiresApproval": true }
```
Errors: `400` validation — including `"Missing School Id"`, `"Invalid School Id"` (not a positive integer) and `"School not found"`.
Rules: password ≥8 chars w/ ≥1 letter + ≥1 digit · phone E.164 (`+?[1-9]\d{1,14}`) · **students (`roleId=3`) are active immediately** and can log in right away · **teachers (`roleId=2`) are created inactive** and cannot log in until an admin approves them (`PATCH /api/users/:id/activate`).

```ts
interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  birthDate: string;            // YYYY-MM-DD
  roleId: number;               // 1 admin | 2 teacher | 3 student
  phoneNumber?: string | null;
  schoolId: number;             // required, positive integer (GET /api/schools)
  academicGradeId?: number | null;
}
```

---

## 2. Users — `/api/users` (all 🔑)

```ts
// PublicUser is the response shape for every user endpoint below.
```

### Shared filter query params (all listing endpoints)

| Param | Type | Description |
|-------|------|-------------|
| `page` | integer | Page number (default `1`) |
| `limit` | integer | Items per page (default `10`) |
| `isActive` | `"true"` \| `"false"` | Filter by active status |
| `academicGradeId` | integer | ID from `AcademicGrade` table — 1–6 = Primaria, 7–11 = Secundaria |
| `birthDateFrom` | `YYYY-MM-DD` | Birthdate ≥ this date |
| `birthDateTo` | `YYYY-MM-DD` | Birthdate ≤ this date |
| `createdAtFrom` | ISO 8601 | Account created ≥ this datetime |
| `createdAtTo` | ISO 8601 | Account created ≤ this datetime |

> `birthDateFrom` must be ≤ `birthDateTo`; same rule applies to `createdAt` range. All range bounds are optional — you may send only one side.

```ts
interface UserListFilters {
  page?: number;
  limit?: number;
  isActive?: boolean;           // sent as string "true"|"false" in query
  academicGradeId?: number;
  birthDateFrom?: string;       // YYYY-MM-DD
  birthDateTo?: string;         // YYYY-MM-DD
  createdAtFrom?: string;       // ISO 8601
  createdAtTo?: string;         // ISO 8601
}
```

Errors: `400` if a date string is unparseable, `isActive` is not `"true"`/`"false"`, or a range is inverted.

---

### `GET /api/users` 🔑 A
All users across all roles. Accepts all shared filter params above.
Response `200`: `Paginated<PublicUser>`.

### `GET /api/users/students` 🔑 A,T
All students. Accepts all shared filter params above.
Response `200`: `Paginated<PublicUser>`.

### `GET /api/users/teachers` 🔑 A
All teachers. Accepts all shared filter params above (`page`, `limit`, `isActive`, ...). Use `?isActive=false` to list teachers pending administrator approval.
Response `200`: `Paginated<TeacherListItem>` — each item is a `PublicUser` plus an additive nested school (flat `schoolId` is kept):
```ts
type TeacherListItem = PublicUser & {
  schoolId: number | null;
  schoolName: string | null;
  school: { id: number; name: string | null } | null;
};
```
Errors: `400` invalid filter/pagination · `403` non-admin.

### `GET /api/users/students/by-school/:schoolId` 🔑 A,T
Path: `schoolId` int. Students filtered to that school. Accepts all shared filter params above.
**Teachers may only query their own school** (school loaded from the DB, not the token); admins any school.
Response `200`: `Paginated<PublicUser>`.
Errors: `400` invalid `schoolId` · `403` `"You can only access data from your own school"`.

---

### `GET /api/users/:id` 🔑 A or self
Path: `id` int. Response `200`: `PublicUser`. Errors: `403` not self/admin · `404` not found.

### `PUT /api/users/:id` 🔑 A or self
Path: `id` int. Request — all optional, **≥1 required**; email/password/roleId not editable here:
```json
{
  "name": "New Name",
  "birthDate": "2010-05-01",
  "phoneNumber": "+593987654321",
  "academicGradeId": 2,
  "schoolId": 1
}
```
Response `200`: `PublicUser`. Errors: `400` validation / no fields · `400` `"Invalid School Id"` · `400` `"School not found"` · `400` `"Students and teachers must belong to a school"` (`schoolId: null` on a student/teacher) · `404` not found.

```ts
interface UpdateUserRequest {
  name?: string;
  birthDate?: string;
  phoneNumber?: string | null;
  academicGradeId?: number | null;
  schoolId?: number | null;     // null only allowed for admin accounts
}
```

### `DELETE /api/users/:id` 🔑 A,T
Path: `id` int. Soft-delete (sets `deletedAt`, `isActive=false`).
**Teachers may only deactivate students** — targeting a non-student returns `403`.
Response `200`:
```json
{ "message": "User deleted", "user": { /* PublicUser */ } }
```
Errors: `400` already deleted · `403` teacher targeting non-student · `404` not found.

### `PATCH /api/users/:id/activate` 🔑 A
Path: `id` int. Approves a pending **teacher** account: sets `isActive=true` and creates an `account_activated` notification for that teacher. Students are active on registration, so they never need activation.
Response `200`:
```json
{ "message": "User activated", "user": { /* PublicUser */ } }
```
Errors: `400` `"Only teacher accounts require activation"` (target is a student or admin) · `400` `"User is already active"` · `400` `"Cannot activate a deleted user"` · `400` `"Invalid User Id"` · `403` `"Insufficient permissions"` (caller is not an admin) · `404` `"User not found"`.

---

## 3. Questions — `/api/questions` (all 🔑 A,T)

**Per-school question bank.** Every AI-generated question belongs to the school of the teacher it is attributed to (`schoolId`). Fallback-bank questions have `schoolId: null`. Teachers may only read/approve/reject/delete questions of **their own school** (`403` `"Question does not belong to your school"`); admins may act on any question. `/my` and `/my/validated-history` stay limited to the teacher's own questions.

```ts
interface Option {
  id: number;
  questionId: number;
  text: string;
  vakValue: "V" | "A" | "K";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
interface Question {
  id: number;
  statement: string;
  contentType: string;                 // e.g. "text"
  vakStyle: "Visual" | "Auditory" | "Kinesthetic";
  origin: string;                      // e.g. "ai_generated"
  validationStatus: "pending" | "approved" | "rejected";
  generationDate: string;
  createdAt: string;
  updatedAt: string;
  teacherId: number | null;
  mediaUrl: string | null;
  rejectionReason: string | null;
  deletedAt: string | null;
  options: Option[];
  schoolId: number | null;             // owning school bank; null for fallback questions
}
```

### `POST /api/questions/generate` 🔑 A,T
Starts background generation of N questions (one Gemini call per question), persists all as `pending` in the attributed teacher's **school bank**. Recent-statement dedupe is scoped to that school. Responds `202` immediately; progress arrives over SSE.

Query param: `count` (integer, 1–10, default `1`) — number of questions to generate in parallel.

Request body (`teacherId` optional, defaults to authenticated user):
```json
{ "vakStyle": "Visual", "teacherId": 2 }
```
Response `202`: `{ message: "Generation started", vakStyle, count }`.

After the batch finishes, a notification is sent to the requester with type `"questions_generated"`.

Errors (synchronous, before any AI call): `400` missing/invalid vakStyle or invalid `count` · `400` `"Teacher must belong to a school to generate questions"` (the attributed teacher — or the admin itself when no `teacherId` is given — has no school) · `404` `"Teacher not found"` (admin passed an unknown `teacherId`) · `429` rate limited.

```ts
// Query
interface GenerateQuestionsQuery {
  count?: number;   // 1–10, default 1
}

// Body
interface GenerateQuestionRequest {
  vakStyle: "Visual" | "Auditory" | "Kinesthetic";
  teacherId?: number | null;
}

// Response 202: { message: string; vakStyle: string; count: number }
```

### `GET /api/questions/my` 🔑 A,T
Returns the authenticated teacher's own questions (paginated + filterable).

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `10` | Items per page |
| `status` | string | — | `pending` \| `approved` \| `rejected` — filter by validation status |
| `vakStyle` | string | — | `Visual` \| `Auditory` \| `Kinesthetic` — filter by VAK style |
| `fromDate` | string (ISO 8601 date) | — | Questions generated on or after this date, e.g. `2026-01-01` |
| `toDate` | string (ISO 8601 date) | — | Questions generated on or before this date, e.g. `2026-12-31` |

Response `200`: `Paginated<Question>`. Ordered by `generationDate` desc.
Errors: `400` invalid `status`, `vakStyle`, or date string.

```ts
interface ListMyQuestionsQuery {
  page?: number;
  limit?: number;
  status?: "pending" | "approved" | "rejected";
  vakStyle?: "Visual" | "Auditory" | "Kinesthetic";
  fromDate?: string;   // ISO 8601 date
  toDate?: string;     // ISO 8601 date
}
```

### `GET /api/questions/my/validated-history` 🔑 A,T
Approved + rejected questions only (paginated + filterable).

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `10` | Items per page |
| `vakStyle` | string | — | `Visual` \| `Auditory` \| `Kinesthetic` — filter by VAK style |
| `fromDate` | string (ISO 8601 date) | — | Questions generated on or after this date, e.g. `2026-01-01` |
| `toDate` | string (ISO 8601 date) | — | Questions generated on or before this date, e.g. `2026-12-31` |

Response `200`: `Paginated<Question>`. Ordered by `generationDate` desc.
Errors: `400` invalid `vakStyle` or date string.

```ts
interface ValidatedHistoryQuery {
  page?: number;
  limit?: number;
  vakStyle?: "Visual" | "Auditory" | "Kinesthetic";
  fromDate?: string;   // ISO 8601 date
  toDate?: string;     // ISO 8601 date
}
```

### `GET /api/questions/:id` 🔑 A,T
Path: `id` int. Response `200`: `Question` (with options). Errors: `403` other school's question · `404` not found.

### `PATCH /api/questions/:id/approve` 🔑 A,T
Path: `id` int. No body. Response `200`: `Question` (`validationStatus: "approved"`). Errors: `400` not pending · `403` other school's question · `404` not found.

### `PATCH /api/questions/:id/reject` 🔑 A,T
Path: `id` int. Request:
```json
{ "rejectionReason": "Statement is ambiguous." }
```
Response `200`: `Question` (`validationStatus: "rejected"`). Errors: `400` missing reason / not pending · `403` other school's question · `404` not found.

```ts
interface RejectQuestionRequest { rejectionReason: string }
```

### `DELETE /api/questions/:id` 🔑 A,T
Path: `id` int. Soft-delete. Response `204` (no body). Errors: `403` other school's question · `404` not found.

---

## 4. Questionnaires — `/api/questionnaires` (all 🔑)

```ts
interface Questionnaire {
  id: number;
  studentId: number;
  status: "in_progress" | "completed" | "abandoned";
  startTime: string;
  createdAt: string;
  updatedAt: string;
  completionPercentage: number | null;
  usedFallback: boolean;
  endTime: string | null;
  deletedAt: string | null;
}

// Question as delivered to a student. The question's vakStyle and each
// option's vakValue are hidden while the quiz is running.
interface PublicQuestionView {
  order: number;
  questionId: number;
  statement: string;
  contentType: string;
  mediaUrl: string | null;
  options: { id: number; text: string }[];
}

// Returned by POST /api/questionnaires and GET /api/questionnaires/active
interface CreateQuestionnaireResponse {
  id: number;
  studentId: number;
  status: string;                  // "in_progress"
  startTime: string;
  usedFallback: boolean;
  createdAt: string;
  updatedAt: string;
  questions: PublicQuestionView[]; // 10 questions, sorted by order
}
```

### `POST /api/questionnaires` 🔑 S
No body. Creates session + selects 10 questions (Visual 4 / Auditory 3 / Kinesthetic 3), sampled at random from the **student's school bank** (approved, AI-generated). All-or-nothing: if every style has enough approved questions for that school, all 10 come from it (`usedFallback: false`); otherwise — or when the student has no school — all 10 come from the fallback bank (`usedFallback: true`). Sources are never mixed and other schools' questions are never used.
Response `201`: `CreateQuestionnaireResponse`.
```json
{
  "id": 12,
  "studentId": 5,
  "status": "in_progress",
  "startTime": "2026-06-07T10:00:00.000Z",
  "usedFallback": false,
  "createdAt": "2026-06-07T10:00:00.000Z",
  "updatedAt": "2026-06-07T10:00:00.000Z",
  "questions": [
    {
      "order": 1,
      "questionId": 88,
      "statement": "Cuando aprendes algo nuevo prefieres...",
      "contentType": "text",
      "mediaUrl": null,
      "options": [
        { "id": 301, "text": "Ver un diagrama" },
        { "id": 302, "text": "Escuchar una explicación" },
        { "id": 303, "text": "Hacerlo con las manos" },
        { "id": 304, "text": "Leer un instructivo" }
      ]
    }
  ]
}
```
Errors: `409` student already has a questionnaire `in_progress`.

### `GET /api/questionnaires` 🔑 S
Query: `page`, `limit`. Own questionnaires. Response `200`: `Paginated<Questionnaire>`.

### `GET /api/questionnaires/active` 🔑 S
Returns the student's current `in_progress` questionnaire with all 10 questions and options. Use this to **recover state** after an abrupt browser close when localStorage was cleared.
Response `200`: `CreateQuestionnaireResponse` (same shape as `POST /api/questionnaires`).
Errors: `404` no active questionnaire.

```ts
// No request body or query params.
// Response shape is identical to CreateQuestionnaireResponse above.
```

### `GET /api/questionnaires/:id` 🔑 S,T,A
Path: `id` int. Response `200`: `Questionnaire`. Errors: `404` not found.

### `PATCH /api/questionnaires/:id/complete` 🔑 S
Path: `id` int. Triggers classification (Lambda XGBoost → `simple_score` fallback) + Gemini AI feedback. **Slow** — show a loader.
Request (`completionPercentage` and `answers` both **required**; behavioural metric fields default to `0` if omitted):
```json
{
  "completionPercentage": 100,
  "answers": [
    {
      "questionId": 88,
      "selectedOptionId": 301,
      "questionTimeSeconds": 12.4,
      "numberOfChanges": 0,
      "timesReviewed": 1
    }
  ]
}
```
Response `200`: `CompleteQuestionnaireResult`:
```json
{
  "resultId": 9,
  "predominantStyle": "Auditory",
  "secondaryStyle": "Visual",
  "visualProbability": 0.16,
  "auditoryProbability": 99.78,
  "kinestheticProbability": 0.07,
  "predominantConfidence": 99.78,
  "profileType": "clear",
  "isMixedProfile": false,
  "classifierType": "xgboost",
  "aiFeedback": "Tu estilo de aprendizaje predominante es Auditivo...",
  "feedbackSource": "gemini"
}
```
Errors: `400` invalid body / not `in_progress` · `404` not found.

```ts
interface CompleteQuestionnaireRequest {
  completionPercentage: number;    // required, 0..100
  answers: AnswerInput[];          // required, exactly 10 items
}
interface AnswerInput {
  questionId: number;              // required
  selectedOptionId: number | null; // null if question was skipped
  questionTimeSeconds?: number;    // defaults to 0
  numberOfChanges?: number;        // defaults to 0
  timesReviewed?: number;          // defaults to 0
}
interface CompleteQuestionnaireResult {
  resultId: number;
  predominantStyle: string;        // "Visual" | "Auditory" | "Kinesthetic"
  secondaryStyle: string | null;
  visualProbability: number;       // 0..100
  auditoryProbability: number;     // 0..100
  kinestheticProbability: number;  // 0..100
  predominantConfidence: number;   // 0..100
  profileType: string | null;      // "clear" | "tendency" | "mixed"
  isMixedProfile: boolean;
  classifierType: string;          // "xgboost" | "simple_score"
  aiFeedback: string;              // Spanish narrative
  feedbackSource: string;          // "gemini" | "predefined"
}
```

### `PATCH /api/questionnaires/:id/abandon` 🔑 S
Path: `id` int. No body. Response `200`: `Questionnaire` (`status: "abandoned"`). Errors: `400` not `in_progress` · `404` not found.

---

## 5. Answers — `/api/questionnaires/:id/answers` (all 🔑)

`:id` is the **questionnaireId** (from path — do not put in body).

```ts
interface Answer {
  id: number;
  questionnaireId: number;
  questionId: number;
  createdAt: string;
  updatedAt: string;
  selectedOptionId: number | null;
  navigationSequence: number | null;
  questionTimeSeconds: number | null;
  numberOfChanges: number | null;
  numberOfClicks: number | null;
  timesReviewed: number | null;
  deletedAt: string | null;
}
```

### `POST /api/questionnaires/:id/answers` 🔑 S
Only `questionId` required; behavioural metrics nullable but **feed the ML classifier** — capture real values. Only allowed while questionnaire is `in_progress`.
Request:
```json
{
  "questionId": 88,
  "selectedOptionId": 301,
  "navigationSequence": 1,
  "questionTimeSeconds": 12.4,
  "numberOfChanges": 0,
  "numberOfClicks": 3,
  "timesReviewed": 1
}
```
Response `201`: `Answer`. Errors: `400` validation / not `in_progress` · `404` questionnaire not found.

```ts
interface CreateAnswerRequest {
  questionId: number;
  selectedOptionId?: number | null;   // null if skipped
  navigationSequence?: number | null;
  questionTimeSeconds?: number | null;
  numberOfChanges?: number | null;
  numberOfClicks?: number | null;
  timesReviewed?: number | null;
}
```

### `GET /api/questionnaires/:id/answers` 🔑 S,T,A
Path: `id` int. Query: `page`, `limit`. Response `200`: `Paginated<Answer>`.

### `GET /api/questionnaires/:id/answers/:answerId` 🔑 S,T,A
Path: `id`, `answerId` int. Response `200`: `Answer`. Errors: `404` not found in this questionnaire.

---

## 6. Results — `/api/results` (all 🔑)

```ts
interface Result {
  id: number;
  questionnaireId: number;
  studentId: number;
  mlModelId: number | null;
  predominantStyle: "Visual" | "Auditory" | "Kinesthetic" | null;
  secondaryStyle: string | null;
  visualProbability: number | null;        // 0..100
  auditoryProbability: number | null;      // 0..100
  kinestheticProbability: number | null;   // 0..100
  predominantConfidence: number | null;    // 0..100
  profileType: string | null;             // "clear" | "tendency" | "mixed"
  isMixedProfile: boolean;
  classifierType: string | null;           // "xgboost" | "simple_score"
  modelVersion: string | null;
  aiFeedback: string | null;
  feedbackSource: string | null;
  createdAt: string;
  updatedAt: string;
}
```

> **Route order note:** named paths (`/my`, `/evolution`, `/stats/…`, `/questionnaire/…`) are registered **before** `/:id` in Express to avoid param collisions. Match this order when building mocks.

---

### `GET /api/results` 🔑 T,A

All results across all students. Supports optional filters.

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `10` | Items per page |
| `studentId` | integer | — | Filter by student |
| `gradeId` | integer | — | Filter by academic grade |
| `schoolId` | integer | — | Filter by school (teachers: own school only, else `403`) |
| `classifierType` | string | — | `xgboost` \| `simple_score` |

Response `200`: `Paginated<Result>`. Errors: `403` `"You can only access data from your own school"` (teacher filtering by another school).

---

### `GET /api/results/my` 🔑 S

Authenticated student's own results, paginated and filterable.

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `10` | Items per page |
| `startDate` | `YYYY-MM-DD` | — | Results on or after this date |
| `endDate` | `YYYY-MM-DD` | — | Results on or before this date |
| `predominantStyle` | string | — | `Visual` \| `Auditory` \| `Kinesthetic` |

Response `200`: `Paginated<Result>`. Errors: `400` invalid date string.

---

### `GET /api/results/questionnaire/:questionnaireId` 🔑 S(own),T,A

Path: `questionnaireId` int. Returns the single result tied to that questionnaire.
Response `200`: `Result`. Errors: `403` not yours (student) · `404` no result.

---

### `GET /api/results/student/:studentId` 🔑 T,A

Paginated result history for a specific student. Same filters as `/api/results/my`.

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `10` | Items per page |
| `startDate` | `YYYY-MM-DD` | — | Results on or after this date |
| `endDate` | `YYYY-MM-DD` | — | Results on or before this date |
| `predominantStyle` | string | — | `Visual` \| `Auditory` \| `Kinesthetic` |

Response `200`: `Paginated<Result>`. Errors: `400` invalid params.

---

### `GET /api/results/evolution/:studentId` 🔑 S(own),T,A

VAK probability evolution over time, grouped into time buckets. Powers the line chart on the student profile.

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `granularity` | `"day" \| "month" \| "year"` | auto-inferred | Bucket size. Auto-inference: ≤90 days → `day`, ≤730 days → `month`, >730 days → `year` |
| `from` | `YYYY-MM-DD` | date of student's first evaluation | Start of range (inclusive) |
| `to` | `YYYY-MM-DD` | today | End of range (inclusive) |

Response `200`:
```json
{
  "studentId": 5,
  "from": "2025-11-01",
  "to": "2026-06-24",
  "granularity": "month",
  "totalEvaluations": 5,
  "dataPoints": [
    {
      "period": "2025-11",
      "predominantStyle": "Visual",
      "avgVisualProbability": 62.0,
      "avgAuditoryProbability": 28.0,
      "avgKinestheticProbability": 10.0,
      "count": 1
    },
    {
      "period": "2026-01",
      "predominantStyle": "Auditory",
      "avgVisualProbability": 34.0,
      "avgAuditoryProbability": 48.0,
      "avgKinestheticProbability": 18.0,
      "count": 1
    }
  ]
}
```

- `period` format: `YYYY-MM-DD` (day) · `YYYY-MM` (month) · `YYYY` (year).
- `predominantStyle` per bucket = most frequent style in that bucket (statistical mode).
- Probabilities are averaged across all evaluations in the bucket, rounded to 2 decimal places.
- `totalEvaluations` = sum of all `count` values.
- If student has no evaluations, `dataPoints` is `[]` and `totalEvaluations` is `0`.

Errors: `400` invalid params or `from > to` · `403` student accessing another student's data.

```ts
interface EvolutionDataPoint {
  period: string;
  predominantStyle: "Visual" | "Auditory" | "Kinesthetic";
  avgVisualProbability: number;      // 0..100, 2 decimal places
  avgAuditoryProbability: number;
  avgKinestheticProbability: number;
  count: number;                     // evaluations in this bucket
}

interface UserEvolutionResult {
  studentId: number;
  from: string;                      // YYYY-MM-DD (effective range start)
  to: string;                        // YYYY-MM-DD (effective range end)
  granularity: "day" | "month" | "year";
  totalEvaluations: number;
  dataPoints: EvolutionDataPoint[];
}
```

---

### `GET /api/results/stats/user/:userId` 🔑 S(own),T,A

Summary stats for a user, computed dynamically from all their results. Powers the stats card on the student profile.

Path: `userId` int.

Response `200`:
```json
{
  "userId": 5,
  "total": 3,
  "predominantStyle": "Visual",
  "profile": "Estable"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `total` | `number` | Total completed evaluations |
| `predominantStyle` | `"Visual" \| "Auditory" \| "Kinesthetic" \| null` | Most frequent style overall; `null` if no evaluations |
| `profile` | `"Estable" \| "Variable" \| null` | `"Estable"` if predominant style appears in ≥60% of evaluations; `"Variable"` otherwise; `null` if no evaluations |

Errors: `400` invalid `userId` · `403` student accessing another user's stats.

```ts
interface UserResultStats {
  userId: number;
  total: number;
  predominantStyle: "Visual" | "Auditory" | "Kinesthetic" | null;
  profile: "Estable" | "Variable" | null;
}
```

---

### `GET /api/results/stats/school/:schoolId` 🔑 T,A

Aggregate VAK summary for a school.

Path: `schoolId` int.

Response `200`:
```json
{
  "schoolId": 1,
  "evaluatedStudents": 42,
  "mostCommonStyle": "Visual",
  "avgPredominantConfidence": 78.34
}
```

| Field | Type | Description |
|-------|------|-------------|
| `evaluatedStudents` | `number` | Count of distinct students with ≥1 result |
| `mostCommonStyle` | `string \| null` | Most frequent predominant style in school; `null` if no results |
| `avgPredominantConfidence` | `number \| null` | Average classifier confidence (0–100); `null` if no results |

Errors: `400` invalid `schoolId` · `403` `"You can only access data from your own school"` (teachers: own school only; admins any).

```ts
interface SchoolResultStats {
  schoolId: number;
  evaluatedStudents: number;
  mostCommonStyle: "Visual" | "Auditory" | "Kinesthetic" | null;
  avgPredominantConfidence: number | null;
}
```

---

### `GET /api/results/stats/school/:schoolId/by-grade` 🔑 T,A

Average VAK probabilities broken down by academic grade for a school.

Path: `schoolId` int. Query: `level?` — `"Primaria"` or `"Secundaria"` to filter grades.

Response `200`: `GradeVakStats[]` (array, one entry per grade, ordered by grade).
```json
[
  {
    "gradeId": 1,
    "gradeName": "1° Primaria",
    "level": "Primaria",
    "evaluatedStudents": 8,
    "avgVisualProbability": 55.2,
    "avgAuditoryProbability": 30.1,
    "avgKinestheticProbability": 14.7
  }
]
```

Errors: `400` invalid `schoolId` or `level` · `403` `"You can only access data from your own school"` (teachers: own school only; admins any).

```ts
interface GradeVakStats {
  gradeId: number;
  gradeName: string;
  level: string;                          // "Primaria" | "Secundaria"
  evaluatedStudents: number;
  avgVisualProbability: number | null;    // null if grade has no evaluated students
  avgAuditoryProbability: number | null;
  avgKinestheticProbability: number | null;
}
```

---

### `GET /api/results/:id` 🔑 S(own),T,A

Path: `id` int. Response `200`: `Result`. Errors: `403` not yours (student) · `404` not found.

---

### `PATCH /api/results/:id/correct-label` 🔑 T,A

Pilot ground-truth: sets `correctedVakLabel` on result + marks the matching ML dataset row `labelSource=teacher_validated`.

Path: `id` int. Request:
```json
{ "vakLabel": "Auditory" }
```
Response `200`: `Result`. Errors: `400` invalid vakLabel · `404` not found.

```ts
interface CorrectResultLabelRequest {
  vakLabel: "Visual" | "Auditory" | "Kinesthetic";
}
```

---

## 7. Notifications — `/api/notifications` (all 🔑 S)

```ts
interface Notification {
  id: number;
  studentId: number;
  resultId: number | null;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### `GET /api/notifications` 🔑 S
Query: `page`, `limit` (default 20), `unread?` (`true` → only unread). Response `200`: `Paginated<Notification>`.

### `GET /api/notifications/unread-count` 🔑 S
Response `200`:
```json
{ "count": 3 }
```

### `PATCH /api/notifications/read-all` 🔑 S
No body. Response `200`:
```json
{ "updated": 3 }
```

### `PATCH /api/notifications/:id/read` 🔑 S
Path: `id` int. No body. Response `200`: `Notification` (`isRead: true`). Errors: `403` not yours · `404` not found.

---

## 8. ML Dataset — `/api/ml-dataset` (all 🔑 T,A)

```ts
interface MLDatasetEntry {
  id: number;
  questionnaireId: number;
  studentId: number;
  visualScore: number | null;
  auditoryScore: number | null;
  kinestheticScore: number | null;
  avgQuestionTime: number | null;
  totalTime: number | null;
  totalChanges: number | null;
  totalClicks: number | null;
  engagementLevel: number | null;
  responseConsistency: number | null;
  completionPercentage: number | null;
  vakLabel: string | null;
  labelSource: "simple_score" | "teacher_validated" | null;
  includedInTraining: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### `GET /api/ml-dataset` 🔑 T,A
Query: `page`, `limit` (default 20), `studentId?`, `gradeId?`, `schoolId?`, `labelSource?` (`simple_score|teacher_validated`), `includedInTraining?` (`true|false`). Response `200`: `Paginated<MLDatasetEntry>`. Errors: `403` teacher filtering by another school's `schoolId`.

### `GET /api/ml-dataset/:id` 🔑 T,A
Path: `id` int. Response `200`: `MLDatasetEntry`. Errors: `404` not found.

---

## 9. Schools — `/api/schools` (🔓 public)

Public (no auth) — the registration form needs to search/select a school before the user logs in. School data is public MINEDU directory data.

**One row per real school.** MINEDU publishes one row per service (`COD_MOD` = school + level); services sharing the same premises (`CODLOCAL`) and name are merged, so `levels` and `codMods` list all of them. Homonymous schools in different premises stay separate (use `district` to tell them apart).

```ts
interface School {
  id: number;
  institutionKey: string; // stable grouping key, e.g. "LOC-337988-CLARETIANO"
  cenEdu: string;         // school name
  district: string;
  address: string;
  businessName: string;
  levels: string[];       // e.g. ["Primaria", "Secundaria"]
  codMods: string[];      // MINEDU modular codes of the merged services
  createdAt: string;
  updatedAt: string;
}
```

### `GET /api/schools` 🔓
Query: `page`, `limit` (**capped at 50**), `search?`, `district?` — both are **case-insensitive partial matches** (`search` on the name `cenEdu`, `district` on `district`); this is the endpoint the frontend searchbox calls. Ordered by name, then district.
Response `200`: `Paginated<School>`.
```
GET /api/schools?search=san%20martin&page=1&limit=10
```

### `GET /api/schools/:id` 🔓
Path: `id` int. Response `200`: `School`. Errors: `400` invalid id · `404` not found.

---

## 10. Status code summary

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No content (delete) |
| 400 | Validation error |
| 401 | Not authenticated (missing/invalid cookie) |
| 403 | Authenticated but forbidden (wrong role / not your resource) |
| 404 | Not found |
| 409 | Conflict (e.g. questionnaire already in progress) |
| 500 | Internal error |
| 502 | Gemini AI failure (question generation) |
| 503 | Could not generate a unique question after max attempts |
