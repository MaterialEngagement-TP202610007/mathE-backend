# ── Builder ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# pnpm version pinned to the one that produced pnpm-lock.yaml (devEngines ^11).
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm exec prisma generate
RUN pnpm build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install all deps (dev included — tsx required by seed script)
RUN pnpm install --frozen-lockfile

# Compiled app
COPY --from=builder /app/dist ./dist

# Generated Prisma client (built in builder stage)
COPY --from=builder /app/src/generated ./src/generated

# Prisma config (root-level, tells Prisma where schema/migrations live)
COPY prisma.config.ts ./

# Prisma directory: schema, migrations, seed script, seed data
COPY prisma ./prisma

# Source files imported by seed.ts at runtime via tsx
COPY src/config ./src/config
COPY src/domain ./src/domain
# Admin bootstrap (seed + `pnpm db:bootstrap-admin`) uses repository/bcrypt impls
COPY src/infrastructure ./src/infrastructure

COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 3000

CMD ["sh", "start.sh"]
