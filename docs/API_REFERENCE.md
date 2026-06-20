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
Errors: `400` validation · `401` invalid credentials or inactive account.

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
Errors: `401` no/invalid cookie, or account deleted/inactive.

### `POST /api/auth/register` 🔓
Request (`phoneNumber`, `schoolId`, `academicGradeId` optional/nullable):
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
Response `201`:
```json
{ "message": "User created successfully" }
```
Errors: `400` validation.
Rules: password ≥8 chars w/ ≥1 letter + ≥1 digit · phone E.164 (`+?[1-9]\d{1,14}`) · **students (`roleId=3`) are created inactive** and cannot log in until an admin activates them.

```ts
interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  birthDate: string;            // YYYY-MM-DD
  roleId: number;               // 1 admin | 2 teacher | 3 student
  phoneNumber?: string | null;
  schoolId?: number | null;
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
All teachers. Accepts all shared filter params above.
Response `200`: `Paginated<PublicUser>`.

### `GET /api/users/students/by-school/:schoolId` 🔑 A,T
Path: `schoolId` int. Students filtered to that school. Accepts all shared filter params above.
Response `200`: `Paginated<PublicUser>`.
Errors: `400` invalid `schoolId`.

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
Response `200`: `PublicUser`. Errors: `400` validation / no fields · `404` not found.

```ts
interface UpdateUserRequest {
  name?: string;
  birthDate?: string;
  phoneNumber?: string | null;
  academicGradeId?: number | null;
  schoolId?: number | null;
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

### `PATCH /api/users/:id/activate` 🔑 A,T
Path: `id` int. Sets `isActive=true`; also creates an `account_activated` notification for the user.
**Teachers may only activate students** — targeting a non-student returns `403`.
Response `200`:
```json
{ "message": "User activated", "user": { /* PublicUser */ } }
```
Errors: `400` already active or deleted · `403` teacher targeting non-student · `404` not found.

---

## 3. Questions — `/api/questions` (all 🔑 A,T)

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
}
```

### `POST /api/questions/generate` 🔑 A,T
AI generates N questions in parallel (one Gemini call per question), dedupes each against existing embeddings, persists all as `pending`. **Slow** (AI + embedding per question; allow ~10–30s × count).

Query param: `count` (integer, 1–10, default `1`) — number of questions to generate in parallel.

Request body (`teacherId` optional, defaults to authenticated user):
```json
{ "vakStyle": "Visual", "teacherId": 2 }
```
Response `201`: `Question[]` — array of generated questions (`validationStatus: "pending"`).

After all questions are created, a notification is sent to the requester with type `"questions_generated"`.

Errors: `400` missing/invalid vakStyle or invalid `count` · `502` Gemini failed · `503` could not produce a unique question after max attempts (may be partial — `Promise.all` fails fast on first error).

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

// Response: Question[]
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
Path: `id` int. Response `200`: `Question` (with options). Errors: `404` not found.

### `PATCH /api/questions/:id/approve` 🔑 A,T
Path: `id` int. No body. Response `200`: `Question` (`validationStatus: "approved"`). Errors: `400` not pending · `404` not found.

### `PATCH /api/questions/:id/reject` 🔑 A,T
Path: `id` int. Request:
```json
{ "rejectionReason": "Statement is ambiguous." }
```
Response `200`: `Question` (`validationStatus: "rejected"`). Errors: `400` missing reason / not pending · `404` not found.

```ts
interface RejectQuestionRequest { rejectionReason: string }
```

### `DELETE /api/questions/:id` 🔑 A,T
Path: `id` int. Soft-delete. Response `204` (no body). Errors: `404` not found.

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

// Question as delivered to a student. The question's own vakStyle is hidden,
// but each option carries its vakValue (V|A|K) label.
interface PublicQuestionView {
  order: number;
  questionId: number;
  statement: string;
  contentType: string;
  mediaUrl: string | null;
  options: { id: number; text: string; vakValue: "V" | "A" | "K" }[];
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
No body. Creates session + selects 10 questions (Visual 4 / Auditory 3 / Kinesthetic 3; fallback bank if short).
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
        { "id": 301, "text": "Ver un diagrama", "vakValue": "V" },
        { "id": 302, "text": "Escuchar una explicación", "vakValue": "A" },
        { "id": 303, "text": "Hacerlo con las manos", "vakValue": "K" },
        { "id": 304, "text": "Leer un instructivo", "vakValue": "V" }
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

### `GET /api/results` 🔑 T,A
Query: `page`, `limit`, `studentId?`, `gradeId?`, `schoolId?`, `classifierType?`. Response `200`: `Paginated<Result>`.

### `GET /api/results/my` 🔑 S
Own results, paginated and filterable.

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `10` | Items per page |
| `startDate` | string (ISO 8601 date) | — | Results created on or after this date, e.g. `2025-01-01` |
| `endDate` | string (ISO 8601 date) | — | Results created on or before this date, e.g. `2025-12-31` |
| `predominantStyle` | string | — | `Visual` \| `Auditory` \| `Kinesthetic` |

Response `200`: `Paginated<Result>`. Errors: `400` invalid date string.

### `GET /api/results/questionnaire/:questionnaireId` 🔑 S(own),T,A
Path: `questionnaireId` int. Response `200`: `Result`. Errors: `403` not yours (student) · `404` no result.

### `GET /api/results/:id` 🔑 S(own),T,A
Path: `id` int. Response `200`: `Result`. Errors: `403` not yours · `404` not found.

### `PATCH /api/results/:id/correct-label` 🔑 T,A
Pilot ground-truth: sets `correctedVakLabel` on result + marks matching ML dataset row `labelSource=teacher_validated`.
Request:
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
Query: `page`, `limit` (default 20), `studentId?`, `gradeId?`, `schoolId?`, `labelSource?` (`simple_score|teacher_validated`), `includedInTraining?` (`true|false`). Response `200`: `Paginated<MLDatasetEntry>`.

### `GET /api/ml-dataset/:id` 🔑 T,A
Path: `id` int. Response `200`: `MLDatasetEntry`. Errors: `404` not found.

---

## 9. Schools — `/api/schools` (🔓 public)

Public (no auth) — the registration form needs to search/select a school before the user logs in. School data is public MINEDU directory data.

```ts
interface School {
  id: number;
  codMod: string;        // MINEDU modular code
  cenEdu: string;        // school name
  level: string;         // Primaria | Secundaria | ...
  address: string;
  district: string;
  businessName: string;
  createdAt: string;
  updatedAt: string;
}
```

### `GET /api/schools` 🔓
Query: `page`, `limit`, `search?` — `search` is a **case-insensitive partial match on the name (`cenEdu`)**; this is the endpoint the frontend searchbox calls. Ordered by name.
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
