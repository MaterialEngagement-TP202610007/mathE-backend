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
- [ ] **B5** Plain-language explanation `docs/explanations/2026-10-09-mvi-transparency-panel-pencil.md` (`/nk-explain pencil`). Route: inline (one passive doc).
- [ ] **V1** Localhost smoke test: generate questions, check `history.length === attempts` and the 10 rules, revalidate to append an entry, confirm the old question still loads, confirm the student sees no MVI data.
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

## Next step
B5 (plain-language explanation), then V1 localhost smoke test.
