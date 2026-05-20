# AGENTS.md

## Project
Backend REST API — educational platform with VAK learning style detection via Gemini AI and XGBoost. Roles: Student and Teacher (RBAC).

## Commands
Always use **pnpm** (`npm` fails via `devEngines`).

```bash
pnpm dev                          # dev server with hot reload
pnpm start                        # run compiled dist/app.js
pnpm exec tsc --noEmit            # typecheck only
pnpm exec prisma generate         # regenerate client after schema changes
pnpm exec prisma migrate dev      # create + apply a migration
docker compose -f dockerfile-compose.yml up -d  # local PostgreSQL
```

> Never run `pnpm build` unless explicitly requested.

## Architecture
DDD + Clean Architecture. **Prisma 7** with `@prisma/adapter-pg`.

### Dependency rule
```
presentation → domain ← infrastructure
```
- `domain` imports **nothing external** — no Express, Prisma, bcrypt, jwt
- `infrastructure` imports from `domain` (implements its interfaces)
- `presentation` imports from `domain` (consumes use cases)
- `presentation` and `infrastructure` **never import each other**

### Layer responsibilities
- **`domain/`** — entities, repository interfaces, use cases, DTOs, adapter interfaces, `CustomError`
- **`infrastructure/`** — Prisma client (single instance in `infrastructure/database/`), repository impls, adapter impls
- **`presentation/`** — controllers, routes, middlewares. No business logic
- **`config/`** — env vars validated at boot via `env-var`

### Key conventions
- **DI is manual** — dependencies assembled in `presentation/routes/*.routes.ts`
- **DTO pattern** — `SomeDto.create(body)` returns `[error?, dto?]`, no thrown exceptions for validation
- **Errors** — use cases throw `CustomError`. The `errorHandler` middleware maps it to its status; anything else → 500
- **Adding a feature** — entity → repository interface → use case(s) → DTO → repository impl → controller → routes → register in `AppRoutes`

## Critical gotchas
- **ESM + NodeNext**: all relative imports need `.js` extension (e.g. `import { X } from "./x.js"`)
- **Prisma client** is generated to `src/generated/prisma/` — gitignored, never edit by hand. Regenerate after any schema change
- **`DATABASE_URL`** is the env var for DB connection, used by both `config/envs.ts` and `prisma.config.ts`