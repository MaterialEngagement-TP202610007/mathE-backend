# HU compliance review

Locator: `odd/tasks/hu-compliance-review.md` (Engram mirror: `odd/hu-compliance-review/tasks`, project `backend`).

## Objective
Every user story in the project sheet (EP-01..EP-07, HU-01..HU-60) is implemented end to end in backend and mathE-frontend, except password recovery (row "–" and HU-13), HU-01 S1 confirmation email and HU-41 audio content, which are out of the MVP scope (user decision 2026-10-10).

## Problem
A static audit on 2026-10-10 (three read-only explorers, base `release` bea2d9c backend / ec28059 frontend) checked 58 in-scope stories: 18 DONE, 7 DONE with minor gaps (marked `DONE*`), 29 PARTIAL and 4 MISSING. Gaps are listed per story below.

## Why
The sheet is the thesis requirements baseline; stories marked as delivered must be demonstrable.

## Scope
- Backend (this repo, branch `feat/hu-compliance-review` from `origin/release`): tasks BE*.
- Frontend (`mathE-frontend`, branch `feat/hu-compliance-review` from `origin/release`): tasks FE*, delegated to the frontend agent session through a brief once the backend contract is ready.
- Spec source: Google Sheet `1EviArfD57KmTlotKGi_Akpvuvkk6a0_oQbFxlpxWGLs` + HU-56..HU-60 (`HU-MVI.xlsx`).

## Constraints
- Clean architecture, manual DI, ESM `.js` imports, DTO `[error, dto]` pattern (AGENTS.md).
- Additive migrations only; students never receive `mvi*` data.
- Strict TDD with Jest for backend behavior; Conventional Commits, no AI attribution.
- Push, PR and merge are the user's decisions.

## Audit result (gaps only)
Layer: BE backend, FE frontend.

| HU | Verdict | Gap |
|---|---|---|
| 01 | OUT OF SCOPE | S1 confirmation email excluded from the MVP (user decision). S2 is done. |
| 02/09 | DONE* | Terms acceptance enforced only in FE; BE does not require/store it. |
| 04 | PARTIAL | Questionnaire count shows "5+" instead of real total (FE). |
| 05/12 | PARTIAL | S2 validation as toast, not per field (FE). |
| 07/14 | PARTIAL | S2 no inactivity logout; no logout on quiz screen (FE). |
| 10 | DONE* | Inactive check runs before password check (BE, minor). |
| 11 | PARTIAL | Approved/rejected counts limited to first 50 / this month (FE). |
| 15 | PARTIAL | Student and teacher share route group; wrong-role screens load (FE). |
| 16 | PARTIAL | S2 no "continue or start new" prompt on active questionnaire (FE). |
| 17 | PARTIAL | S1 no exclusion of already-seen questions (BE); S2 no retry on generation error (FE). |
| 19 | PARTIAL | S2 "Siguiente" allowed without answer (FE). |
| 20 | PARTIAL | Doubled option label not checked against question `vakStyle` (BE). |
| 21 | PARTIAL | S1 no image/placeholder when `mediaUrl` is null (FE). |
| 28 | DONE* | Label always "Generado por IA" even for predefined feedback (FE bug). |
| 29 | PARTIAL | S1 answers not saved server-side before submit (BE+FE); S2 discard is two steps (FE). |
| 30/32 | PARTIAL | Secondary style not named/described on mixed profile (FE). |
| 34 | PARTIAL | Students lack evolution chart; no 3-month/1-year presets; no "needs two results" message (FE). |
| 35 | PARTIAL | No SSE push for `result_available` (BE); notification not marked read when result opened (FE). |
| 36/48 | PARTIAL | Grade selector commented out; no per-grade empty state; no student count per style (BE+FE). |
| 37 | PARTIAL | No student search by name/code (BE+FE). |
| 38 | PARTIAL | No school-wide variation view; single result labelled "Estable" (BE+FE). |
| 39 | PARTIAL | S2 no bounded retry when saving results fails (BE). |
| 40 | PARTIAL | Content type not shown in pending list (FE). |
| 41 | OUT OF SCOPE (audio) | Audio excluded from the MVP (user decision); text and image are done. |
| 42 | PARTIAL | Teacher cannot set VAK style on approve (BE+FE). |
| 44 | MISSING | No FE for `PATCH /results/:id/correct-label`; no `correctedAt` (BE+FE). |
| 46 | DONE* | Empty message not style-specific (FE). |
| 47 | PARTIAL | Failure toast does not say AI is down or bank is used; no recovery signal (BE+FE). |
| 49 | MISSING | No teacher-facing export by grade/period (BE+FE). |
| 50 | MISSING | No avg response time / completion rate (BE+FE). |
| 51 | MISSING | No week/month/quarter/year filter on reports (BE+FE). |
| 52 | PARTIAL | No "provisional result" notice (FE); Lambda timeout + retries can exceed 5 s (BE). |
| 54 | PARTIAL | No "contact support" option; silent redirect on result load error (FE). |
| 58/60 | DONE* | MVI badge and approved-over-MVI mark missing on list pages (FE nit). |

DONE without gaps: 03, 08, 18, 22, 23, 24, 25, 26, 27, 31, 33, 43, 45, 53, 55 (S1 not measurable statically), 56, 57, 59.

## Tasks
Backend:
- [x] **BE1** Auth hardening: require and store terms acceptance (`termsAcceptedAt`) (HU-02/09); check password before activation state (HU-10).
- [x] **BE2** Questionnaire: exclude already-seen questions (HU-17); strict VAK label distribution check (HU-20); autosave answers + resume progress (HU-29); bounded retry on result save (HU-39); classifier timeout within 5 s (HU-52).
- [ ] **BE3** Questions: approve with `vakStyle` (HU-42); `question_failed` reason `ai_unavailable` + AI health signal (HU-47).
- [ ] **BE4** Reports: period filter `from/to` (HU-51); per-style student counts by grade (HU-48); avg response time + completion rate (HU-50); CSV export by grade/period (HU-49).
- [ ] **BE5** Results: student search (HU-37); school-wide stability + single-result `null` profile (HU-38); `correctedAt` on label correction (HU-44); SSE `result_available` (HU-35).

Frontend (brief to frontend agent after BE contracts land):
- [ ] **FE1** Session and roles: idle logout + quiz logout (HU-07/14); per-role routes (HU-15); per-field profile validation (HU-05/12); send terms acceptance (HU-02/09).
- [ ] **FE2** Dashboards: real totals (HU-04/11).
- [ ] **FE3** Quiz: continue-or-new dialog (HU-16/29); retry on generation error (HU-17); require answer (HU-19); image placeholder (HU-21); autosave (HU-29); feedback source label (HU-28); provisional notice (HU-52); error panel + support (HU-54).
- [ ] **FE4** Results: mixed-profile secondary style (HU-30/32); student evolution with presets (HU-34); notification read + SSE (HU-35).
- [ ] **FE5** Teacher: grade selector (HU-36/48); student search (HU-37); stability monitor (HU-38); content-type badge (HU-40); VAK selector on approve (HU-42); labeling page (HU-44); style empty message (HU-46); AI-down banner (HU-47); MVI badge on lists (HU-58/60).
- [ ] **FE6** Reports: export button (HU-49); stats cards (HU-50); period filter (HU-51).

## Acceptance criteria
- Every in-scope HU scenario is satisfied in both layers, verified by tests (BE) and typecheck/lint/build plus a localhost check (FE).
- Existing endpoints stay backward compatible.

## Checks
Backend: `pnpm exec tsc --noEmit`, `pnpm exec jest`. Frontend: `tsc -b`, `eslint .`, `vite build`.

## Progress
- 2026-10-10: branches created in both repos from `origin/release`. Audit done (route: three delegated read-only explorers; trigger: 58 stories across two repos, far beyond inline budget).
- Delivery forecast: well above 400 authored lines across both repos. Strategy `ask-on-risk`; chain strategy `feature-branch-chain` (user decision 2026-10-10).
- Scope decision 2026-10-10: HU-01 confirmation email and HU-41 audio are out of the MVP.
- 2026-10-10 BE1 done on `feat/hu-compliance-be1` (route: delegated writer). HU-10 RED `pnpm exec jest tests/unit/domain/use-cases/auth/login-user.use-case.test.ts` → Expected 400, Received 401; GREEN 9/9; commit `3aebfa4`. HU-02/09 RED focused jest (DTO, auth use cases, user entity, user mapper) → TS2339 `termsAcceptedAt` does not exist on `UserEntity`/`PublicUser`/`AuthUser`; GREEN 82/82; commit `feat(auth): require terms acceptance on registration` (the commit that checks BE1 off). Migration `20261010140205_add_terms_accepted_at_to_user` (additive `ADD COLUMN`, existing users NULL). Checks: `pnpm exec tsc --noEmit` clean; `pnpm exec jest` 59 suites, 560/560 passed. Contract: register requires `acceptTerms: true` (400 "Terms and privacy policy must be accepted" otherwise; English to match the DTO file); users expose nullable `termsAcceptedAt`; a wrong password always returns 400 "Invalid credentials", and the inactive 401 comes back only after the password checks out.
- BE1 RDD: range e6d4f8b..82e57a6 assessed high (`hot_path` auth); consent granted; 4-lens review approved and acknowledged (lineage review-31889cab31450773). Non-blocking follow-ups: R4-001 deploy-order guard for mandatory `acceptTerms` (mitigated: frontend A1 ships first), R3 terms persistence only proven with mocked repo (repo `create` passes the whole DTO to Prisma), R2 mapper test wording 'optional' → 'nullable'. Frontend phase A plan received from the frontend agent: slices A1..A7 (`feat/hu-compliance-fe-a1`..`a7`).
- 2026-10-10 BE2 done on `feat/hu-compliance-be2` (route: delegated writer; strict TDD, Jest). HU-20 RED `pnpm exec jest tests/unit/domain/use-cases/question/generate-question.use-case.test.ts` → 2 failed (Visual draft doubling A accepted: expected 2 calls, received 1; Auditory draft doubling V resolved instead of rejecting); GREEN 125/125 question suites; commit `ecf46fa` `fix(questions): require VAK option distribution to match question style`. HU-17 RED `pnpm exec jest tests/unit/domain/use-cases/questionnaire/create-questionnaire.use-case.test.ts` → TS2305 `SeenQuestion` missing, then 4 behavioural failures (seen ids 1/2/3 reassigned, seen fallback statements reused); repo RED TS2554 `findApprovedByStyle` takes 3 args; GREEN 68/68; commit `3da03d3` `feat(questionnaires): avoid questions the student already received` (unseen first per style for the school bank and the fallback bank; when the unseen pool is too small the remaining slots reuse seen questions of that style instead of failing). HU-39 RED complete-questionnaire suite → TS2554 (no retry config), GREEN 19/19; commit `78a5ec8` `feat(questionnaires): retry result persistence before failing` (2 retries, 200/400 ms, injectable; then 503 "Your answers were saved, but your result could not be stored right now. Please submit again in a few moments to get your result." in English like the file's other errors; re-submission resumes from the stored dataset). HU-52 RED Lambda adapter suite → 4 failed (first timeout 7000 instead of 4500; throttled worst case 13995 ms; retry timeout 4000 instead of 3701); GREEN 16/16; commit `972f003` `fix(classifier): bound Lambda classification by a 4.5 s deadline` (`LAMBDA_TIMEOUT_MS` default 7000→4000, new `LAMBDA_DEADLINE_MS` default 4500 caps each attempt and cancels retries). HU-29 RED (DTO, use cases, repo, controller, route suites) → TS2307/TS2339 (`save-questionnaire-progress` DTO/use case, `saveProgress`, `answers` missing); GREEN 148/148 focused; commit `feat(questionnaires): save answers progressively and resume` (this commit also checks BE2 off). No migration (upsert without a unique index: progress saves row-lock the in-progress questionnaire; completion deletes drafts then inserts the 10 submitted answers). Checks: `pnpm exec tsc --noEmit` clean; `pnpm exec jest` 63 suites, 610/610 passed. Contract: new `PUT /api/questionnaires/:id/answers` (student, 1–10 answers, upsert, returns `{ questionnaireId, answers }`, 400/403/404/409); `GET /api/questionnaires/active` adds `answers`, `answeredCount`, `resumeIndex`; `PATCH /complete` unchanged but may now return the 503 above; `docs/FRONTEND_INTEGRATION.md` updated. Not done: `.env.template`/`.env.example` (blocked by a deny rule for this agent) should document `LAMBDA_TIMEOUT_MS=4000` and `LAMBDA_DEADLINE_MS=4500`; a local `.env` with `LAMBDA_TIMEOUT_MS=7000` is still capped by the deadline.

## Delivery
- Tracker branch (draft, no-merge PR to `release`): `feat/hu-compliance-review` in each repo.
- Backend slices, each branched from the previous one: `feat/hu-compliance-be1` (from tracker) → `be2` → `be3` → `be4` → `be5`. Child PR #1 targets the tracker; each later child targets its parent.
- Frontend: phase A (FE-only gaps, no backend dependency) starts now on the frontend agent; phase B (contract-dependent: HU-02/09 terms flag, HU-29 autosave, HU-35 SSE, HU-37, HU-38, HU-42, HU-47, HU-48..51) after the matching BE slice lands.
- Deploy order note: BE1 makes `acceptTerms` mandatory, so the frontend must send `acceptTerms: true` (phase A) before BE1 is deployed.

## Route per task
| Task | Route | Trigger evidence |
|---|---|---|
| Audit | delegated (3 read-only explorers) | 58 stories, two repos |
| BE1..BE5 | delegated direct (one writer per task) | 2+ non-trivial files per task |
| FE* | frontend agent session (brief) | separate repo and session, user request |

## Next step
BE2 review (RDD) on `feat/hu-compliance-be2`; then BE3 on `feat/hu-compliance-be3` (branched from `be2`). Frontend phase B can implement HU-29 S1 from `docs/FRONTEND_INTEGRATION.md`.
