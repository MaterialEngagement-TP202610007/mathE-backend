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
- Delivery strategy: ask-on-risk (default).

## Tasks
- [x] T1 — Config, domain port, MVI adapter
- [x] T2 — Persistence (schema, migration, entity, repository)
- [x] T3 — Hybrid prompt
- [ ] T4 — Validation loop in generation + bulk bank/wake-up + DI
- [ ] T5 — Approve-over-MVI + revalidate endpoint
- [ ] T6 — CSV export + docs

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
| T1–T6 | delegated direct (one writer) | 2+ non-trivial files per task |

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
- Commit: `feat(question): align generation prompt with MVI catalog` (hash = the commit containing this line)

## Next step
T4.
