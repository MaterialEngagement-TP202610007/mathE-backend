# Frontend Integration Guide

> Backend REST API — educational platform with VAK learning-style detection (Gemini AI + XGBoost classifier).
> This document is the single source of truth for the frontend agent: auth flow, endpoint contracts, request/response shapes, role rules, and end-to-end workflows.

---

## 1. Quick facts

| Item | Value |
|------|-------|
| Base URL (dev) | `http://localhost:3000` |
| API prefix | `/api` |
| Auth scheme | JWT in **HttpOnly cookie** `auth_token` (no header, no JS access) |
| Content type | `application/json` |
| Swagger / OpenAPI | `http://localhost:3000/api-docs` (interactive) |
| ID type | All resource ids are **integers** |
| Date format | ISO 8601 strings in responses (`2026-06-04T12:00:00.000Z`) |

### CORS — enabled with credentials
The server enables CORS with `credentials: true`, origin from env `CORS_ORIGIN` (default `http://localhost:5173`, comma-separated list supported). The auth cookie only flows if the frontend sends requests with credentials included.

**Frontend MUST send credentials on every request:**
- `fetch`: `credentials: "include"`
- `axios`: `withCredentials: true`

Cookie flags: `HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`. `Secure` works on `http://localhost` in Chrome/Firefox (localhost is a secure context). For a non-localhost dev host over plain HTTP, the cookie won't be sent — use HTTPS or localhost.

---

## 2. Roles & RBAC

Numeric role ids (kept in sync with the DB seed):

| Role | `roleId` | Notes |
|------|----------|-------|
| Admin | `1` | Full user management |
| Teacher | `2` | Generates/validates questions, reviews results, corrects labels |
| Student | `3` | Takes questionnaires, sees own results & notifications |

- Every protected route runs `authMiddleware` (validates the JWT) then a `roleGuard(...)`.
- `401` = no/invalid token. `403` = authenticated but wrong role (or not your resource).
- Some routes are **self-or-admin**: a user may act on their own `:id`, otherwise admin role required (e.g. `GET /api/users/:id`, `PUT /api/users/:id`).

### Account activation gotcha
On register, **students are created `isActive=false`** and **cannot log in** until an admin activates them (`PATCH /api/users/:id/activate`). Teachers/Admins are active immediately. Surface this in the registration UX: after a student signs up, show "pending activation" — login will fail with `401` until activated.

---

## 3. Authentication

### TypeScript interfaces

```ts
// Returned inside the login response (password stripped server-side)
interface PublicUser {
  id: number;
  email: string;
  name: string;
  birthDate: string;        // ISO date
  createdAt: string;
  updatedAt: string;
  phoneNumber: string | null;
  isActive: boolean;
  roleId: number | null;
  academicGradeId: number | null;
  school: { id: number; name: string | null } | null;  // resolved name, not bare schoolId
  deletedAt: string | null;
}

interface LoginResponse {
  user: PublicUser;          // token is NOT here — it's set as an HttpOnly cookie
}
```
> On `login` and `me`, the user's `schoolId` is resolved to a `school` object `{ id, name }`. Other `/api/users/*` endpoints still return the raw `schoolId`.

> The JWT is delivered as the HttpOnly `auth_token` cookie and is **not readable by JavaScript**. The frontend never stores or sends the token manually — the browser attaches the cookie automatically when `credentials: "include"` is set. To know the current user's role, read `user.roleId` from the login response and keep it in app state (or call `GET /api/users/:id`).

### `POST /api/auth/login`
Body:
```json
{ "email": "user@example.com", "password": "Passw0rd" }
```
- `200` → `LoginResponse` `{ user }` **+** `Set-Cookie: auth_token=...; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`
- `400` → validation error `{ "error": "Invalid Email" }`
- `401` → invalid credentials or inactive account

### `POST /api/auth/logout`
No body. Clears the `auth_token` cookie.
- `200` → `{ "ok": true }`

### `GET /api/auth/me`
No body — relies on the cookie. Validates the session (cookie JWT + user still exists & active). **Call this on app load / refresh** to restore auth state, since the token is HttpOnly and unreadable by JS.
- `200` → `{ user }` (same shape as login)
- `401` → not logged in / session invalid → route to login

### `POST /api/auth/register`
Body:
```json
{
  "email": "student@example.com",
  "password": "Passw0rd",
  "name": "Jane Doe",
  "birthDate": "2010-05-01",
  "roleId": 3,
  "phoneNumber": "+593987654321",   // optional, E.164
  "schoolId": 1,                     // optional
  "academicGradeId": 2               // optional
}
```
- `201` → `{ "message": "User created successfully" }`
- `400` → validation error

**Password rule:** min 8 chars, at least one letter and one number (`/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/`).
**Phone rule:** E.164-ish `+?[1-9]\d{1,14}`.

### Sending the token
Nothing to do manually — the browser sends the `auth_token` cookie automatically **as long as every request includes credentials** (`fetch` → `credentials: "include"`, `axios` → `withCredentials: true`). There is no `Authorization` header anymore.

On any `401` from a protected route, drop client-side auth state and redirect to login (the cookie is invalid/expired). Use `user.roleId` from the login response for routing/guards, but **never trust it for security** — the server re-checks on every request.

---

## 4. Conventions

### Pagination
List endpoints accept `?page=<n>&limit=<n>` (defaults: `page=1`, `limit=10`; ml-dataset & notifications default `limit=20`). Response shape:
```ts
interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
```

### Error shape
All errors return:
```json
{ "error": "Human readable message" }
```
Status codes used: `400` validation, `401` auth, `403` forbidden, `404` not found, `500` internal, `502` AI/Gemini failure, `503` could not generate unique question.

---

## 5. Domain entities (response shapes)

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
  usedFallback: boolean;        // true if local fallback questions were used
  endTime: string | null;
  deletedAt: string | null;
}

// Questions as delivered to a student taking a questionnaire. The question's
// own vakStyle is hidden, but each option exposes its vakValue (V|A|K) label.
interface PublicQuestionView {
  order: number;
  questionId: number;
  statement: string;
  contentType: string;          // e.g. "text"
  mediaUrl: string | null;
  options: { id: number; text: string; vakValue: "V" | "A" | "K" }[];
}

interface CreateQuestionnaireResponse {
  id: number;
  studentId: number;
  status: string;               // "in_progress"
  startTime: string;
  usedFallback: boolean;
  createdAt: string;
  updatedAt: string;
  questions: PublicQuestionView[];   // 10 questions, randomised order
}

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
  aiFeedback: string | null;               // Spanish narrative feedback
  feedbackSource: string | null;           // "gemini" | "predefined"
  createdAt: string;
  updatedAt: string;
}

// Returned by POST .../complete (slimmer than full Result)
interface CompleteQuestionnaireResult {
  resultId: number;
  predominantStyle: string;
  visualProbability: number;
  auditoryProbability: number;
  kinestheticProbability: number;
  isMixedProfile: boolean;
  classifierType: string;
  aiFeedback: string;
  feedbackSource: string;
}

// Teacher-facing question (full metadata, with options + vakValue)
interface Question {
  id: number;
  statement: string;
  contentType: string;
  vakStyle: "Visual" | "Auditory" | "Kinesthetic";
  origin: string;                          // e.g. "ai_generated"
  validationStatus: "pending" | "approved" | "rejected";
  generationDate: string;
  createdAt: string;
  updatedAt: string;
  teacherId: number | null;
  mediaUrl: string | null;
  rejectionReason: string | null;
  deletedAt: string | null;
  options: {
    id: number; questionId: number; text: string; vakValue: "V" | "A" | "K";
    createdAt: string; updatedAt: string; deletedAt: string | null;
  }[];
}

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

---

## 6. Endpoint reference

Legend: 🔓 public · 🔑 auth required · roles in parentheses.

### Auth — `/api/auth`
| Method | Path | Access | Body | Returns |
|--------|------|--------|------|---------|
| POST | `/login` | 🔓 | `{email, password}` | `{user}` + sets cookie |
| POST | `/logout` | 🔓 | — | `{ok:true}` clears cookie |
| GET | `/me` | 🔑 | — | `{user}` (session check) |
| POST | `/register` | 🔓 | register body (§3) | `{message}` |

### Users — `/api/users` (all 🔑)
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/` | Admin | paginated all users |
| GET | `/students` | Admin, Teacher | paginated students |
| GET | `/teachers` | Admin | paginated teachers |
| GET | `/students/by-school/:schoolId` | Admin, Teacher | paginated |
| GET | `/:id` | Admin **or self** | single user |
| PUT | `/:id` | Admin **or self** | update profile (body below) |
| DELETE | `/:id` | Admin | soft-delete → `{message, user}` |
| PATCH | `/:id/activate` | Admin | activate inactive user → `{message, user}` |

Update profile body (all optional, ≥1 required):
```json
{ "name": "...", "birthDate": "2010-05-01", "phoneNumber": "+593...", "academicGradeId": 2, "schoolId": 1 }
```
Email / password / roleId are **not** editable here.

### Questions — `/api/questions` (all 🔑, Admin/Teacher)
| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/generate` | `{ vakStyle, teacherId? }` | `201` `Question` (status=pending) |
| GET | `/my?status=&page=&limit=` | — | paginated own questions |
| GET | `/my/validated-history` | — | paginated approved+rejected |
| GET | `/:id` | — | `Question` with options |
| PATCH | `/:id/approve` | — | `Question` (status=approved) |
| PATCH | `/:id/reject` | `{ rejectionReason }` | `Question` (status=rejected) |
| DELETE | `/:id` | — | `204` (soft delete) |

- `vakStyle` ∈ `"Visual" | "Auditory" | "Kinesthetic"`. `teacherId` defaults to the authenticated user.
- `status` filter ∈ `pending | approved | rejected` (omit for all).
- Generation can return `502` (Gemini failed) or `503` (couldn't produce a unique, non-redundant question after max attempts). Show a retry affordance. **Generation is slow** (AI + embedding round-trips) — show a spinner and allow ~10–30s.

### Questionnaires — `/api/questionnaires` (all 🔑)
| Method | Path | Roles | Body | Returns |
|--------|------|-------|------|---------|
| POST | `/` | Student | — | `201` `CreateQuestionnaireResponse` (10 questions) |
| GET | `/` | Student | — | paginated own questionnaires |
| GET | `/:id` | Student, Teacher, Admin | — | `Questionnaire` |
| PATCH | `/:id/complete` | Student | `{ totalTimeSeconds?, completionPercentage? }` | `CompleteQuestionnaireResult` |
| PATCH | `/:id/abandon` | Student | — | `Questionnaire` (status=abandoned) |

### Answers — `/api/questionnaires/:id/answers` (all 🔑)
| Method | Path | Roles | Body | Returns |
|--------|------|-------|------|---------|
| POST | `/:id/answers` | Student | answer body (below) | `201` `Answer` |
| GET | `/:id/answers?page=&limit=` | Student, Teacher, Admin | — | paginated answers |
| GET | `/:id/answers/:answerId` | Student, Teacher, Admin | — | `Answer` |

Answer body (`:id` = questionnaireId, taken from path — do not put in body):
```json
{
  "questionId": 42,
  "selectedOptionId": 17,     // null if skipped
  "navigationSequence": 1,    // order the student visited this question
  "questionTimeSeconds": 12.4,
  "numberOfChanges": 0,       // how many times they changed the selection
  "numberOfClicks": 3,
  "timesReviewed": 1
}
```
Only `questionId` is required; the behavioural metrics are nullable but **feed the ML classifier** — capture them for real results. Answers can only be posted while the questionnaire is `in_progress`.

### Results — `/api/results` (all 🔑)
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/` | Teacher, Admin | paginated; filters `studentId, gradeId, schoolId, classifierType` |
| GET | `/my` | Student | own results (paginated + filtered — see below) |
| GET | `/questionnaire/:questionnaireId` | Student(own), Teacher, Admin | result for a questionnaire |
| GET | `/:id` | Student(own), Teacher, Admin | single result |
| PATCH | `/:id/correct-label` | Teacher, Admin | `{ vakLabel }` — pilot ground-truth |

#### `GET /api/results/my` — query params
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `10` | Items per page |
| `startDate` | string (ISO 8601 date) | — | Include results created on or after this date, e.g. `2025-01-01` |
| `endDate` | string (ISO 8601 date) | — | Include results created on or before this date, e.g. `2025-12-31` |
| `predominantStyle` | string | — | Filter by VAK style: `Visual` \| `Auditory` \| `Kinesthetic` |

Returns `Paginated<Result>`. Invalid date strings return `400 { "error": "Invalid startDate" }`.

#### `GET /api/results` — query params (Teacher/Admin)
| Param | Type | Description |
|-------|------|-------------|
| `page` | integer | Page number (default `1`) |
| `limit` | integer | Items per page (default `10`) |
| `studentId` | integer | Filter by student |
| `gradeId` | integer | Filter by academic grade |
| `schoolId` | integer | Filter by school |
| `classifierType` | string | Filter by classifier, e.g. `xgboost` |

`correct-label` body: `{ "vakLabel": "Visual" | "Auditory" | "Kinesthetic" }`. Sets `correctedVakLabel` on the result and marks the matching ML dataset row `labelSource=teacher_validated`.

### Notifications — `/api/notifications` (all 🔑, Student only)
| Method | Path | Returns |
|--------|------|---------|
| GET | `/?page=&limit=&unread=true` | paginated notifications |
| GET | `/unread-count` | `{ count: number }` |
| PATCH | `/read-all` | `{ updated: number }` |
| PATCH | `/:id/read` | updated `Notification` |

### ML Dataset — `/api/ml-dataset` (all 🔑, Teacher/Admin)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/?page=&limit=&studentId=&gradeId=&schoolId=&labelSource=&includedInTraining=` | paginated dataset entries |
| GET | `/:id` | single entry |

`labelSource` ∈ `simple_score | teacher_validated`. `includedInTraining` ∈ `true | false`.

### Schools — `/api/schools` (🔓 public, no auth)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/?page=&limit=&search=` | paginated; `search` = partial name match (searchbox) |
| GET | `/:id` | single school by id |

Public so the **registration form** can search/select a school before login. `search` matches the school name (`cenEdu`) case-insensitively. Returns `Paginated<School>`:
```ts
interface School {
  id: number; codMod: string; cenEdu: string; level: string;
  address: string; district: string; businessName: string;
  createdAt: string; updatedAt: string;
}
```

---

## 7. Core workflows

### A. Student takes a questionnaire (the main flow)
```
1. POST /api/questionnaires
   → returns { id, questions[10], usedFallback, ... }
   → start a client-side timer; render questions in given `order`.

2. For each question the student answers:
   POST /api/questionnaires/:id/answers
   body: { questionId, selectedOptionId, navigationSequence,
           questionTimeSeconds, numberOfChanges, numberOfClicks, timesReviewed }
   → Track behaviour locally and send on answer/next. These metrics feed the ML model.

3. When the student finishes:
   PATCH /api/questionnaires/:id/complete
   body: { totalTimeSeconds, completionPercentage }
   → returns CompleteQuestionnaireResult: predominantStyle, probabilities,
     isMixedProfile, aiFeedback (Spanish text), classifierType, feedbackSource.
   → Render the VAK result screen from this payload directly.

   (If the student quits early: PATCH /api/questionnaires/:id/abandon)

4. Later, results are retrievable:
   GET /api/results/my            (list)
   GET /api/results/questionnaire/:questionnaireId  (this attempt)
   GET /api/results/:id           (detail)
```
Notes:
- The `complete` call is where classification + AI feedback happen (Lambda/XGBoost with `simple_score` fallback, Gemini feedback with predefined fallback). It may take a few seconds — show a loading state.
- The questionnaire-taking question payload hides the question's `vakStyle`, but each **option includes its `vakValue`** (`V`/`A`/`K`) label.

### B. Teacher authors & validates questions
```
1. POST /api/questions/generate { vakStyle: "Visual" }
   → AI generates statement + 4 options, dedupes against existing, persists as pending.
2. Review queue: GET /api/questions/my?status=pending
3. Approve:  PATCH /api/questions/:id/approve
   Reject:   PATCH /api/questions/:id/reject { rejectionReason }
4. Audit:    GET /api/questions/my/validated-history
```
Only **approved** questions are eligible to appear in student questionnaires (with local fallback if a style runs short).

### C. Admin onboarding
```
1. Student self-registers (roleId=3) → created inactive.
2. Admin lists pending: GET /api/users/students
3. Admin activates: PATCH /api/users/:id/activate
   → creates a notification for the student; they can now log in.
```

### D. Teacher reviews results & builds ground truth (pilot)
```
1. GET /api/results?studentId=&schoolId=...   (filtered list)
2. GET /api/results/:id                        (detail + probabilities)
3. If the predicted label is wrong:
   PATCH /api/results/:id/correct-label { vakLabel }
   → updates the ML dataset row to teacher_validated for future retraining.
4. Inspect training data: GET /api/ml-dataset?labelSource=teacher_validated
```

---

## 8. Suggested frontend API client

```ts
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    credentials: "include", // REQUIRED — sends/receives the auth_token cookie
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) { /* drop auth state, redirect to login */ }
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

// login — cookie is set by the browser from the Set-Cookie header
const { user } = await api<LoginResponse>("/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password }),
});
// persist `user` (incl. roleId) in app state; no token to store

// logout — clears the cookie server-side
await api("/auth/logout", { method: "POST" });
```

### Role-based routing
Read `user.roleId` from the login response (the token itself is not JS-readable):
- `3` (Student) → take-questionnaire + my-results + notifications.
- `2` (Teacher) → question authoring + results review + dataset.
- `1` (Admin) → user management (+ everything teacher can see).

---

## 9. Open items / coordinate with backend
1. **CORS** is enabled with `credentials: true` (origin via `CORS_ORIGIN`). Add the deployed frontend origin to that env in prod.
2. **No refresh-token** — cookie Max-Age is 7 days; on `401`, force re-login. Logout endpoint exists (`POST /api/auth/logout`).
3. **Reference data:** schools now have a public lookup (`GET /api/schools?search=`). Academic grades and roles still have no endpoint — use seeded ids (`roleId`: 1 admin / 2 teacher / 3 student) for now.
4. **No password reset** flow exists.
5. Generation (`/questions/generate`) and questionnaire `complete` are latency-sensitive (external AI calls) — design optimistic/loading UI.
6. **Cookie + SameSite=Strict caveat:** the frontend must be served from the same site as the API (or a configured origin) and use `credentials: "include"`. Cross-site embedding/redirect flows won't carry the cookie under `Strict`.
