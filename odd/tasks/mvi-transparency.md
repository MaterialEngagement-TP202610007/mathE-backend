# MVI transparency panel

Locator: `odd/tasks/mvi-transparency.md` (Engram mirror: `odd/mvi-transparency/tasks`, project `backend`).

## Objective
Let teachers see, in the question detail panel, which MVI rules were applied, how many attempts the generation loop needed, and what failed in each attempt, explained in plain language.

## Problem
- `mviResult` stores only `{ approved, violations, attempts }`.
- `violations` belongs to the saved attempt only. The earlier attempts and their texts are discarded inside the loop in `generate-question.use-case.ts`.
- The adapter fetches the catalog rules from `/reglas` but drops them.
- The frontend therefore cannot show either the per-attempt trace or the criteria checklist.

## Why
It is a key UI moment for the thesis presentation, and it makes the rules engine's decision explainable to teachers.

## Scope
- **Backend (this repo):**
  - Add optional `history` and `rules` keys inside the existing `mviResult` JSONB.
  - Write documentation and a plain-language explanation.
- **Frontend:** delegated to the `mathe-frontend-87` session through a brief once the backend contract is merged.
- **MVI repo:** untouched.

## Constraints
- Additive and backward compatible: no migration; old rows without `history` keep loading.
- Students must never receive `mvi*` data (existing test `questionnaire.repository.impl.test.ts:50`).
- No extra Gemini or MVI calls.
- Strict TDD with Jest. Conventional Commits with no AI attribution.
- No push until `tsc`, the full jest suite and the localhost smoke test pass. Merge to `release` is the user's call.

## Data contract
```ts
mviResult: {
  approved: boolean; violations: ItemViolation[]; attempts: number; // unchanged
  history?: Array<{
    attempt: number;
    kind: "generation" | "revision" | "revalidation";
    statement: string;
    options: { text: string; vakValue: "V" | "A" | "K" }[];
    approved: boolean;
    violations: ItemViolation[];
    validatedAt: string; // ISO
  }>;
  rules?: Array<{ id: string; description: string; threshold: number | null; severity: "blocking" | "warning" }>;
}
```

## Tasks
- [x] **B1** Parse catalog rules (`ItemValidatorCatalog.rules`) in the MVI adapter. Route: delegated writer (B1–B3 span 6+ non-trivial files). Commit `48e8393`. RED: adapter suite failed on missing `rules`; GREEN: adapter + domain suites 35/35, 396 tests.
- [x] **B2** Record a per-attempt `history` and a `rules` snapshot in the generation loop. Route: delegated writer. Commit `6d342e1`. RED: 7 failing in generate-question suite; GREEN: question use-case suites 8/8, 117 tests.
- [x] **B3** Revalidation appends a `revalidation` entry and refreshes `rules`. Route: delegated writer. Commit `696c039`. RED: 5 failing in revalidate suite; GREEN: full suite 59/59, 546 tests.
- [x] **B4** Docs: `docs/FRONTEND_INTEGRATION.md`, `docs/INTEGRATION_MVI_MATHE.md` and the Swagger text. Route: delegated writer. Commit `7a4e276`. Passive docs + JSDoc; tsc clean.
- [x] **B5** Plain-language explanation `docs/explanations/2026-10-09-mvi-transparency-panel-pencil.md` (`/nk-explain pencil`). Route: inline (one passive doc). Structural readback only (passive doc).
- [x] **V1** Localhost smoke test: generate questions, check `history.length === attempts` and the 10 rules, revalidate to append an entry, confirm the old question still loads, confirm the student sees no MVI data.
  - Setup: local MVI 0.4.0 on :3001 with an ephemeral token, backend `MVI_MODE=advisory` on :3000, Postgres `postgres-dev` on :5433.
  - Generated #47 (Auditory), #48 (Visual) and #49 (Kinesthetic): all `passed`. #48 took 2 attempts, the others 1. `history.length === attempts` for all three, and `rules` had 10 entries each.
  - #48 history: `1:generation:x[legibilidad-nivel/blocking, vocabulario-nivel/blocking]`, then `2:revision:ok[vocabulario-nivel/warning]`.
  - `POST /api/questions/48/validate` returned 200 and appended `3:revalidation:ok`; `attempts` stayed at 2.
  - Old #29 returned 200 with its original keys `approved, attempts, violations`.
  - A student calling `GET /api/questions/48` got 403. The student questionnaire repo test (no `mvi*` keys) is green.
  - The 10 rule ids from `/reglas` are: longitud-enunciado, legibilidad-nivel, vocabulario-nivel, redaccion-positiva, longitud-opciones, homogeneidad-opciones, exclusividad-opciones, independencia-banco, correspondencia-dimension, composicion-dimensiones. `distribucion-posicional` is a bank-level check and not part of this list.
- [ ] **F0** Send the frontend brief to `mathe-frontend-87`.

## Acceptance criteria
- New questions carry `history` (one entry per MVI call) and `rules` (the catalog snapshot).
- Revalidation keeps the earlier history and appends one entry.
- Old questions and all existing endpoints keep working unchanged.
- `tsc` is clean and the full jest suite is green.

## Checks
`pnpm exec tsc --noEmit`, `pnpm exec jest`, and the localhost smoke test (V1).

## Progress
- Baseline on `release` 9120926: tsc OK, jest 59 suites / 538 tests green.
- Branch `feat/mvi-transparency` created from 9120926.
- Delivery forecast: about 250 authored lines, single PR.
- B1–B4 done (actual: 12 files, +432/-32 including tests and docs). Final checks: `pnpm exec tsc --noEmit` clean; `pnpm exec jest` 59 suites / 546 tests green.
- Note for V1: `history` holds one entry per answered MVI call, while `attempts` counts loop iterations (including malformed Gemini drafts or AI errors that never reached MVI). `history.length === attempts` holds only when every iteration reached MVI; in advisory `failed`, `attempts` is `maxAttempts`.
- `history[].attempt` is the 1-based position in `history`, not the loop iteration. Revalidation keeps `attempts` (previously reset to 1).

- RDD: range 9120926..7007c23 assessed as medium (`slice_budget_reached`); consent granted; reliability review approved and acknowledged (lineage review-583cd9b10047e7fe). Non-blocking suggestions R3-001 (`revalidate-question.use-case.ts:80`) and R3-002 (`generate-question.use-case.ts:104-106`) are follow-ups.

## Next step
Push `feat/mvi-transparency`, then send the frontend brief (F0) to `mathe-frontend-87`.
