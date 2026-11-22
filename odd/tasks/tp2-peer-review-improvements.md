# TP2 peer-review improvements

Objective: resolve the evaluator group's first-cycle findings (docs/Evidence of Tests Report.odt) and fill its "Aplicación de mejoras realizadas" section.
Branches: backend `fix/tp2-peer-review` (from `origin/release` 640b71f), frontend `fix/tp2-peer-review` (from `origin/main` 31e8f83); backups `backup/pre-tp2-peer-review` pushed on both remotes. Delivery: merge into the deploy branches (backend `release` → Render, frontend `main` → Netlify) after verification. Test runners: backend `pnpm test` (node:test via tsx), frontend `pnpm test` (vitest).

## Specs

- **S1 — MVI 401 (CP001, CP003–CP009).** Evaluator result: "Error 401" / "No aprobado". Verified cause: the token was never loaded in Swagger "Authorize" (CP002 only ran the no-token step). No code defect. Fix: the CP preconditions state how the evaluator obtains `MVI_TOKEN` and that only the raw value is pasted (without "Bearer"). Re-execute CP001–CP009 with the token and record obtained results.
- **S2 — Registration data validation (CP017, CP018).** Evaluator: "no valida los datos adecuadamente al poner un nombre x igual lo reconoce al igual la fecha de nacimiento" and "Lo único que se valida es que se ingrese datos por tipo, longitud más allá de eso cualquiera puede crear cuentas falsas". Both frontend and backend must reject:
  - a name that is not at least a first name and a last name (two or more words, each with at least 2 letters, letters/spaces/hyphens/apostrophes only);
  - a birth date in the future or outside the role's age range. Assumption (pending user confirmation): student 5–20 years, teacher 18–100 years.
  Backend errors stay in the DTO `[error?, dto?]` pattern; frontend shows the message next to each field.
- **S3 — Email existence verification (CP019).** Evaluator: "La duplicidad de cuenta por correo solo es por existencia en la base de datos mas no se verifica la existencia de esta." Decision (user, 2026-11-22): verify with a 6-digit one-time code (OTP) sent by email, behind backend flag `EMAIL_VERIFICATION_ENABLED` (default off = current flow, "para que en la demo no haya problemas"). Provider behind a domain `EmailSenderAdapter`; Brevo free tier (HTTPS API) as the zero-cost implementation. Existing users are migrated as verified. The register response tells the frontend whether verification is required; login is blocked only when the flag is on and the email is unverified. Emails are also normalized (trim + lowercase) so case variants cannot create duplicate accounts.
- **S4 — Role redirect notice (CP030).** Evaluator: "Redirige al Dashboard pero no a la sección estudiante indicada". Verified: the redirect works but is silent. Fix: when a user opens a screen of another role, the app redirects to their panel and explains why (toast).
- **S5 — Evidence report.** Fill "Aplicación de mejoras realizadas" (finding → solution table and re-execution table: case, story, expected, obtained) in the evaluator's report format. Never invent the evaluator's comments.

## Tasks

| ID | Specs | Repo | Route | Status | Evidence |
|----|-------|------|-------|--------|----------|
| T1 | S2 | backend | inline | done | 686ef0a; jest 798/798 |
| T2 | S2, S4 | frontend | inline | done | c840971; tsc+eslint clean; live local check (name, calendar 2005-2021 / 1925-2008, CP030 toast) |
| T3 | S3 | backend | inline | done (code); deploy pending | 42772b1 + fix 530c86e; jest 850/850; verifier: 1 blocker (ILIKE wildcards) fixed; Brevo test send 201 |
| T4 | S3 | frontend | inline | done (code); E2E pending deploy | 5c8ab2f; tsc+eslint clean; page rendered locally |
| T5 | S1 | docs (CP + report) | inline | pending | |
| T6 | S1–S4 | live re-execution (chrome-devtools) | inline | in progress: CP001–CP009 PASS with token (2026-11-22); CP017–CP019, CP030 after deploy | |
| T7 | S5 | report .odt | inline | pending | |

Risk notes: T3 touches auth and adds a migration (high-risk items 1 and 2) → independent verifier after its checks.

## Log

- **L1 (2026-11-22, user):** "'/Users/nicolas/Documents/Workspace/University/Material Engagement/docs/Evidence of Tests Report.odt'. Esto es debemos de completar, la seccion: "Aplicación de mejoras realizadas:" tal y como se indica en el formato. Pero primero necesito que corrigas las observaciones usa el mcp de chrome dev tools para absolver todo: https://mathe-education.netlify.app/login, https://mvi-95f5.onrender.com/docs. Para varias de las pruebas del MVI se necesita el token [...] ahora necesito que resolvamos las observaciones y errores identificados por el equipo evaluador"
- **L2 (2026-11-22, user):** "tenia pensado integrar resend para la verificacion de correos unicamnete como pide el CP019, pero debemos tener una flag para desactivarlo y permitir que nos cree la cuenta sin ese flujo, osea como lo tenemos actualemnte, para que en la dmeo no haya problemas"
- **L3 (2026-11-22, user):** "No, pero dice que no se verifica la existencia del correo, solo en la bd, lo cual es cierto, entones lo del codigo OTP, puede ser una alternativa viable"
- **L4 (2026-11-22, user):** "lo mejor seria guardar una copia, osea crear una rama y publicarala como se encunetra ahora, y modificar en la rama release o de depsliegue tanto para frontend y para backend [...] vamos a empezar con la integracion"
- **L5 (evidence):** Resend's `resend.dev` sender only delivers to the account owner (needs an owned domain); Render free blocks SMTP ports 25/465/587; Brevo free rewrites free-mail senders but delivers to any recipient over HTTPS.
- **L6 (assumption):** age ranges student 5-20, teacher 18-100 (pending user confirmation).
- **L7 (evidence):** T1-T4 committed on `fix/tp2-peer-review` (backend 686ef0a, 42772b1; frontend c840971, 5c8ab2f). Frontend has no test runner: checks are tsc, eslint and live Chrome checks against a local Vite proxied to the production API. Local backend not run (reading `.env` denied; DB target unknown).
- **L8 (evidence, 2026-11-22):** CP001–CP009 re-executed from the MVI Swagger page (chrome-devtools) with the Bearer token: /salud ok 0.4.0; /reglas 200, 10 rules, only homogeneidad-opciones is advertencia; CP002 401 without token / 200 aprobado with token; CP003 34 words blocked, original approved; CP004 5 words warning / 6 blocked; CP005 simple negation warning / double negation blocked; CP006 longitud-opciones 17 vs 9.25 and exclusividad blocked; CP007 jaccard banco[0] blocked / empty bank approved; CP008 correspondencia (opcion 2 V tiene 0) and composicion (V:3 A:0 K:1) blocked; CP009 approved with homogeneidad warning. All match the expected results.
- **L9 (verifier, 2026-11-22):** S2 PASS (behaviour), S3 one blocker B1: Prisma `equals`+`mode: insensitive` compiles to ILIKE without escaping, so `_`/`%` were wildcards (wrong duplicate rejection, enumeration, rate-limit bypass, parallel code guessing). Fixed in 530c86e: escape `\ % _`, `orderBy id asc`, attempts reserved atomically with `updateMany ... attempts < max` before comparing. Migration verified on scratch Postgres (backfill correct, no drift). Non-blocking notes kept open: verify-email returns 200 for already verified accounts (minor enumeration); promoteToAdmin does not set emailVerifiedAt; accounts created while the flag is off must verify if the flag is later turned on; after a failed first email the resend waits up to 60 s.
- **L10 (2026-11-22, user):** provided Brevo key and EMAIL_FROM_ADDRESS (not stored in the repo). Restricted key: /v3/account and /v3/senders answer 403 permission_denied; POST /v3/smtp/email test to the sender's own address answered 201.
- **Next:** user sets Render env; merge into deploy branches; T5-T7.
