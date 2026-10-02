# Feature: MVI integration

## Objective
Integrate MVI (external item validator) between Gemini question generation and persisting a question as `pending`, per `docs/INTEGRATION_MVI_MATHE.md`. Done = works end-to-end on localhost in `advisory` mode.

## Problem / why
The backend only checks structure (`isValid`). Option V/A/K labels feed the classifier input and the research dataset label; a mislabeled option corrupts both. MVI checks item construction rules (R1–R9 + dimension composition) before teacher review.

## Scope (authorized)
- Config + env template, domain port, MVI HTTP adapter.
- Question persistence of MVI diagnosis (`mviStatus`, `mviResult`, `mviCatalogVersion`, `mviValidatedAt`, `approvedOverMvi`).
- Hybrid prompt alignment (user decision 2026-10-02): keep banning generic verbs, require catalog markers, statement <= 30 words, 6to primaria / 1ro secundaria.
- Validation + feedback loop in generation, bank for R8, wake-up.
- Approve-over-MVI flag, `POST /api/questions/:id/validate`.
- CSV export columns, docs.

Out of scope: `/banco/verificar`, `/catalogo/verificar`, frontend UI.

## Constraints
- Clean architecture: domain imports nothing external; DI manual in routes; ESM `.js` imports.
- MVI fields never exposed to students. Token never logged nor sent to frontend.
- TDD: strict, enabled (source: user global config). Runner: `pnpm test -- <path>` (Jest 30 + ts-jest).
- RDD: on (default). Per work-unit commit assessment.
- Delivery strategy: ask-on-risk (default) -> chain strategy `feature-branch-chain` (see Delivery).

## Tasks
- [x] T1 — Config, domain port, MVI adapter
- [x] T2 — Persistence (schema, migration, entity, repository)
- [x] T3 — Hybrid prompt
- [x] T4 — Validation loop in generation + bulk bank/wake-up + DI
- [x] T5 — Approve-over-MVI + revalidate endpoint
- [x] T6 — CSV export + docs
- [x] T7 — Allowed vocabulary in prompt (from smoke-test finding: only R3 blocked)
- [x] T8 — Revise rejected attempt in place (smoke test 2 finding)

## Acceptance criteria
- Generated questions persist `mviStatus` in {passed, failed, unavailable, skipped} with diagnosis when available.
- MVI down never blocks generation in `advisory`; `gate` drops items failing all attempts.
- Teacher responses include MVI fields; student questionnaire views do not.
- `pnpm test` and `pnpm exec tsc --noEmit` green.

## Checks
`pnpm test`, `pnpm exec tsc --noEmit`, `pnpm exec prisma migrate dev`, local smoke against MVI on :3001.

## Route per task
| Task | Route | Trigger evidence |
|---|---|---|
| T1–T8 | delegated direct (one writer) | 2+ non-trivial files per task |

## Progress / evidence
### T1
- RED: `pnpm test -- tests/unit/infrastructure/adapters/mvi-item-validator.adapter.test.ts`: suite failed (adapter module not found, TS2307).
- GREEN: same command: 24 passed. `pnpm exec tsc --noEmit`: clean. `pnpm test`: 57 suites, 449 tests passed.
- Commit: 02b2ced

### T2
- RED: `pnpm test -- tests/unit/domain/entities/question.entity.test.ts tests/unit/infrastructure/repositories/question.repository.impl.test.ts`: both suites failed to compile (missing `mviStatus`/`approvedOverMvi` on entity, `findBankStatements`, `updateMviValidation`, `approve` 2nd arg, `CreateQuestionData.mviStatus`).
- GREEN: same command: 24 passed. `pnpm exec tsc --noEmit`: clean. `pnpm test`: 57 suites, 458 tests passed.
- Migration `20261002062016_add_mvi_validation_to_question`: additive ALTER TABLE "Question" ADD COLUMN x5 (approvedOverMvi BOOLEAN NOT NULL DEFAULT false, mviCatalogVersion VARCHAR(20), mviResult JSONB, mviStatus VARCHAR(20), mviValidatedAt TIMESTAMP(3)). Applied to local dev DB without reset.
- Commit: `feat(question): persist MVI validation diagnosis` (hash = the commit containing this line)

### T3
- RED: `pnpm test -- tests/unit/domain/prompts/question-generation.prompt.test.ts`: suite failed to compile (TS2554: builder accepted 1-2 args, got 3).
- GREEN: same command: 21 passed. `pnpm exec tsc --noEmit`: clean. `pnpm test`: 57 suites, 471 tests passed.
- Commit: e2dcf46 `feat(question): align generation prompt with MVI catalog`

### T4
- RED: `pnpm test -- tests/unit/domain/use-cases/question/generate-question.use-case.test.ts` and `.../bulk-generate-questions.use-case.test.ts`: both suites failed to compile (TS2554 extra ctor arg; missing `mviMode`/`now` config).
- GREEN: same commands: 28 and 18 passed. `pnpm exec tsc --noEmit`: clean. `pnpm test`: 57 suites, 488 tests passed.
- DI: `question.routes.ts` builds `MviItemValidatorAdapterImpl` only when `MVI_MODE !== "off" && MVI_URL`; passes `mviMode` + validator to both use cases.
- Commit: `feat(question): validate generated questions with MVI before saving` (hash = the commit containing this line)

### T5
- RED: `pnpm test -- tests/unit/domain/use-cases/question/approve-question tests/unit/domain/use-cases/question/revalidate`: 2 suites failed (approve: 5 assertions on `approve(id, flag)` failed; revalidate: module not found). Controller suite failed to compile (TS2339 `validate` missing).
- GREEN: same command: 2 suites, 15 passed. `pnpm exec tsc --noEmit`: clean. `pnpm test`: 59 suites, 507 tests passed.
- Student leak regression tests (questionnaire + `findApprovedByStyle` views with MVI fields on the row) passed immediately: existing allow-lists already strip them, so no RED was possible; they are guards.
- Route `POST /api/questions/:id/validate` (role guard + `questionValidationRateLimiter` 30/10min, reuses the generation `itemValidator`, null when MVI disabled). No per-limiter tests exist in `rate-limit.middleware.test.ts`, so none added.
- Commit: `feat(question): add MVI revalidation endpoint and approval override flag` (hash = the commit containing this line)

### T6
- Non-code task (script + docs): no RED/GREEN applicable. Checks: `sh -n scripts/export-csv.sh`: ok (no syntax errors; query has no single quotes). `pnpm exec tsc --noEmit` and `pnpm test` unchanged from T5 (59 suites, 507 tests passed).
- `scripts/export-csv.sh`: `preguntas` now exports `mviStatus`, `approvedOverMvi`, `mviCatalogVersion`, `mviValidatedAt`.
- `docs/INTEGRATION_MVI_MATHE.md`: added section 12 (implementation status), marked implemented items; `docs/FRONTEND_INTEGRATION.md`: Question shape, endpoint row and "MVI diagnosis on questions (teacher/admin)" section.
- Commit: `docs(mvi): document MVI integration status and frontend fields` (hash = the commit containing this line)

### Smoke test 1
- 3 Visual questions generated via HTTP, all saved as `failed` (advisory) with only `vocabulario-nivel` (R3) blocking; R1, R9 and composition passed. Catalog 0.2.0, maxWords 30, markers V34/A45/K46 parsed from the real /reglas.

### T7
- RED: `pnpm test -- tests/unit/infrastructure/adapters/mvi-item-validator.adapter.test.ts tests/unit/domain/prompts/question-generation.prompt.test.ts`: both suites failed to compile (TS2339/TS2353: `vocabulary`/`functionWords` missing on `ItemValidatorCatalog`).
- GREEN: same command: 2 suites, 56 passed. `pnpm exec tsc --noEmit`: clean. Full `pnpm test`: 59 suites, 518 tests passed.
- `ItemValidatorCatalog` gains `vocabulary` and `functionWords`; adapter reads `niveles[nivel].vocabulario` and `reglas[vocabulario-nivel].parametros.palabrasFuncionales` (defensive, deduped). Prompt adds a vocabulary section (full lists, comma-separated) and intersects markers with the vocabulary (original list kept when the intersection is empty).

### Smoke test 2
- 3 Visual questions, all `failed` only by R3 `vocabulario-nivel` with 2-6 out-of-vocabulary words each (down from 6-9 in smoke test 1). Root cause: each retry built a brand-new prompt (new random topic + seed), so MVI feedback was applied to a different question instead of fixing the rejected one.

### T8
- RED: `pnpm test -- tests/unit/domain/prompts/question-generation.prompt.test.ts tests/unit/domain/use-cases/question/generate-question.use-case.test.ts`: prompt suite failed to compile (TS2724: no export `buildQuestionRevisionPrompt`); 3 new use-case tests failed (retry still used a fresh prompt).
- GREEN: same command passes. `pnpm exec tsc --noEmit`: clean. Full `pnpm test`: 59 suites, 528 tests passed.
- `buildQuestionRevisionPrompt(vakStyle, previous, feedback, { catalog })` shares option/marker/vocabulary/JSON sections with the generation prompt. The use case revises the last MVI-rejected attempt (same 4 options, order and `vakValue`s); a revision with different `vakValue`s or failing `isValid` is skipped and the same rejected attempt is revised again. Fresh prompt only for the first attempt or when nothing was rejected yet.
- Commit: `fix(question): revise MVI-rejected attempts instead of regenerating` (hash = the commit containing this line)

## Delivery
- Strategy: `ask-on-risk` -> chain strategy `feature-branch-chain` (user choice 2026-10-02).
- Slices:
  - S1 = T1-T2 (02b2ced, 771d3da); native review approved and acknowledged, lineage `review-5c6b19e72be37b16`.
  - S2 = T3-T4 (e2dcf46 + 3a165dd); native review granted, approved and acknowledged, lineage `review-675cbe4e92fcb53b`.
  - S3 = T5-T6 (ac96c58 + T6 commit); pending native review by parent.

## RDD per task
- T1-T2: granted / approved.
- T3-T4 (S2): granted / approved and acknowledged, lineage `review-675cbe4e92fcb53b`. One informational WARNING follow-up (see Follow-ups).
- T5-T6 (S3): pending native review by parent.

## Follow-ups
- S2 WARNING `R3-bulk-context-unguarded`: bulk `loadValidationContext` (wakeUp/getCatalog/findBankStatements) is not guarded; a bank query failure fails the whole batch.
- S1 suggestion (informational) `R3-001`: adapter lines 255-270.

## Next step
Smoke test 3 after T8.
