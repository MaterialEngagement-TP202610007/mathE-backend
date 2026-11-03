# TP2 test cases and acceptance gaps

Objective: verify the 26 TP2 user stories on the live site, close the acceptance gaps, and write the official `Casos de Prueba.xlsx`.
Branches: backend `fix/tp2-acceptance-gaps` into `release`; frontend `fix/tp2-acceptance-gaps` (worktree `mathE-frontend-worktrees/tp2-acceptance-gaps`) into `main`. Delivery: `exception-ok`, both pushes authorized by the user. Test runner: Jest in backend; frontend has no runner, so it is verified with `tsc -b`, `eslint .`, `vite build`, and the browser.

## Specs
- S1. Verify before writing cases: "primero haz la comprobacion del mismo antes de seguir y verifica todo ello".
- S2. Create the test cases in the official format: `LISTA CP` plus one sheet per case with author, preconditions, steps, expected results, execution type, priority, requirements and postconditions.
- S3. Each case traces to a story, scenario number and criterion title from `docs/User Stories TP2.xlsx` (26 stories, 53 scenarios).
- S4. Code fixes may be pushed: "frontend-> main (autodeploy)", "backend -> release (autodeploy)".
- S5. Test accounts: `teacher@example.com` and `student@example.com` on https://mathe-education.netlify.app/.

## Tasks
| ID | Specs | Route | Status | Commit or evidence |
|---|---|---|---|---|
| T1 Live verification of everything forceable in production | S1, S5 | inline | done | Log L3 |
| T2 Backend: generic login error (HU-02 S2, HU-05 S2) | S1, S4 | inline | committed, review consent pending | `44fb5b0`; RED 4 failed ("Invalid Password" received), GREEN 7/7; suite 778/778; tsc clean |
| T3 Frontend: acceptance gaps (HU-01, 04, 06, 07, 08, 11, 14, 15, 24; `/register` direct link) | S1, S4 | inline | committed, review consent pending | `31e8f83` on frontend branch; tsc, eslint, vite build pass; verified on the local stack (L5) |
| T4 Isolated local stack for scenarios production cannot force (HU-13 S2, 14 S2, 22 S2, 23, 24, 25 S2, 26) | S1 | inline | done | Log L5 |
| T5 Deploy and re-verify on the live site | S1, S4, S5 | inline | pending | |
| T6 Generate `Casos de Prueba.xlsx` | S2, S3 | inline | pending | |

Route evidence: no Writer trigger reason fired, because the gaps are small and read inline. The mapping trigger fired once for the first static audit.

## Log
- L1 (2026-11-02, user): "necesito que leas este documento y me informes que es lo que se debe realizar por esta actividad, necesito que armes un checklist de lo que debemos de realizar [...] Asi que necesitom que le des enfasis a partir del punto 04 en adelante que son los "Casos de prueba"."
- L2 (2026-11-03, user): "De acuerdo necesito que hagas una revaluacion, ya se encuentra levantado la web: https://mathe-education.netlify.app/. [...] usa el mcp de chrome devtools, y cra los casos de prueba, pero primero haz la comprobacion del mismo antes de seguir y verifica todo ello, si hay que subir codigo, puedes hacrlo en las repos: frontend-> main (autodeploy) backend -> release (autodeploy)"
- L3 (2026-11-03): the chrome-devtools MCP did not connect in this session, so verification uses isolated headless Chrome over CDP with a separate profile. Live results: registration works (201 and "Cuenta en revisión" for a teacher; "Este correo ya está registrado." for a duplicate). Confirmed gaps: "Invalid Password" with `abc123`; `/register` direct link redirects to `/login`; back button hidden on question 1; no confirmation screen after submit; no automatic-generation notice in the report; submit button disabled without terms, so no notice. Timings: screens 1.1 to 1.4 s, submit 7.2 s then 1.9 s. Production residue from testing: pending teacher `cp-hu03-qa-teacher@example.com`; two questionnaires on the test student; questions 16 to 18 for the test teacher (18 rejected, 17 approved, 16 pending).
- L4 (2026-11-03): decisions. HU-18 S1 asks for a date and the screen shows one, so no migration is added; the date is the generation date and is reported as an observation. HU-19 S1 ("banco") and HU-20 S1 (AI fails while generating the questionnaire) describe behaviour the product does not have; both need the story reworded, and the cases describe real behaviour and flag this.
- L5 (2026-11-03): local stack verification (throwaway Postgres on port 55432, MVI with vocabulary threshold 0, `QUESTION_MAX_GENERATION_ATTEMPTS=2`, no `LAMBDA_URL`, `GEMINI_FEEDBACK_TIMEOUT_MS=1`). Observed: "Con observaciones del motor" after 2 attempts with per-attempt history; approval over observations shows the warning "El motor encontró observaciones; tu aprobación quedará registrada." and history marks "Aprobada sobre MVI"; MVI down gives "Motor no disponible" in 17 s; a question without MVI status shows "Sin validar" in list, review and analysis; a question without attempt history shows final observations and "El detalle por intento no está disponible para preguntas creadas antes de esta función."; fallback bank used with no approved school questions; predefined feedback "Respuesta estándar"; a 4-3-3 answer split gives Visual 40/30/30 mixed with both secondary styles named. Fix timings: auth page fade 241 ms, dashboard route 255 ms, next question 367 ms, option feedback 97 ms; back button disabled at 50% opacity on question 1; confirmation screen "¡Cuestionario enviado con éxito!" with "Ver mi resultado".
- L6 (2026-11-03): both commits assessed high (backend `hot_path` auth plus item 2 escalation; frontend `hot_path` AuthLayout). RDD is on, so pushing waits on the user's consent decision for each candidate.
