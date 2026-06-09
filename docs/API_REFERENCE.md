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

### `GET /api/users` 🔑 A
Query: `page`, `limit`. Response `200`: `Paginated<PublicUser>`.

### `GET /api/users/students` 🔑 A,T
Query: `page`, `limit`. Response `200`: `Paginated<PublicUser>`.

### `GET /api/users/teachers` 🔑 A
Query: `page`, `limit`. Response `200`: `Paginated<PublicUser>`.

### `GET /api/users/students/by-school/:schoolId` 🔑 A,T
Path: `schoolId` int. Query: `page`, `limit`. Response `200`: `Paginated<PublicUser>`.

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

### `DELETE /api/users/:id` 🔑 A
Path: `id` int. Soft-delete. Response `200`:
```json
{ "message": "User deleted", "user": { /* PublicUser */ } }
```

### `PATCH /api/users/:id/activate` 🔑 A
Path: `id` int. Activates (sets `isActive=true`); also creates a notification for the user. Response `200`:
```json
{ "message": "User activated", "user": { /* PublicUser */ } }
```
Errors: `400` already active or deleted.

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
AI generates statement + 4 options, dedupes against existing, persists as `pending`. **Slow** (AI + embedding; allow ~10–30s).
Request (`teacherId` optional, defaults to authenticated user):
```json
{ "vakStyle": "Visual", "teacherId": 2 }
```
Response `201`: `Question` (`validationStatus: "pending"`).
Errors: `400` missing/invalid vakStyle · `502` Gemini failed · `503` could not produce a unique question.

```ts
interface GenerateQuestionRequest {
  vakStyle: "Visual" | "Auditory" | "Kinesthetic";
  teacherId?: number | null;
}
```

### `GET /api/questions/my` 🔑 A,T
Query: `status?` (`pending|approved|rejected`, omit for all), `page`, `limit`. Response `200`: `Paginated<Question>`.

### `GET /api/questions/my/validated-history` 🔑 A,T
Query: `page`, `limit`. Approved + rejected only. Response `200`: `Paginated<Question>`.

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
  totalTimeSeconds: number | null;
  completionPercentage: number | null;
  usedFallback: boolean;
  endTime: string | null;
  deletedAt: string | null;
}

// Question as delivered to a student — NO VAK metadata (no vakStyle / vakValue)
interface PublicQuestionView {
  order: number;
  questionId: number;
  statement: string;
  contentType: string;
  mediaUrl: string | null;
  options: { id: number; text: string }[];
}
interface CreateQuestionnaireResponse {
  id: number;
  studentId: number;
  status: string;                 // "in_progress"
  startTime: string;
  usedFallback: boolean;
  createdAt: string;
  updatedAt: string;
  questions: PublicQuestionView[]; // 10 questions, randomised order
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
        { "id": 301, "text": "Ver un diagrama" },
        { "id": 302, "text": "Escuchar una explicación" },
        { "id": 303, "text": "Hacerlo con las manos" },
        { "id": 304, "text": "Leer un instructivo" }
      ]
    }
  ]
}
```

### `GET /api/questionnaires` 🔑 S
Query: `page`, `limit`. Own questionnaires. Response `200`: `Paginated<Questionnaire>`.

### `GET /api/questionnaires/:id` 🔑 S,T,A
Path: `id` int. Response `200`: `Questionnaire`. Errors: `404` not found.

### `PATCH /api/questionnaires/:id/complete` 🔑 S
Path: `id` int. Triggers classification (Lambda/XGBoost → `simple_score` fallback) + AI feedback. **Slow** — show loader.
Request (both optional):
```json
{ "totalTimeSeconds": 184.5, "completionPercentage": 100 }
```
Response `200`: `CompleteQuestionnaireResult`:
```json
{
  "resultId": 9,
  "predominantStyle": "Visual",
  "visualProbability": 0.6,
  "auditoryProbability": 0.2,
  "kinestheticProbability": 0.2,
  "isMixedProfile": false,
  "classifierType": "lambda_xgboost",
  "aiFeedback": "Tu estilo de aprendizaje predominante es Visual...",
  "feedbackSource": "gemini"
}
```
Errors: `400` invalid body / not `in_progress` · `404` not found.

```ts
interface CompleteQuestionnaireRequest {
  totalTimeSeconds?: number;          // ≥ 0
  completionPercentage?: number;      // 0..100
}
interface CompleteQuestionnaireResult {
  resultId: number;
  predominantStyle: string;
  visualProbability: number;          // 0..1
  auditoryProbability: number;
  kinestheticProbability: number;
  isMixedProfile: boolean;
  classifierType: string;             // "lambda_xgboost" | "simple_score"
  aiFeedback: string;                 // Spanish narrative
  feedbackSource: string;             // "gemini" | "predefined"
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
  visualProbability: number | null;        // 0..1
  auditoryProbability: number | null;
  kinestheticProbability: number | null;
  isMixedProfile: boolean;
  classifierType: string | null;           // "lambda_xgboost" | "simple_score"
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
Query: `page`, `limit`. Own results. Response `200`: `Paginated<Result>`.

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
| 500 | Internal error |
| 502 | Gemini AI failure (question generation) |
| 503 | Could not generate a unique question after max attempts |
