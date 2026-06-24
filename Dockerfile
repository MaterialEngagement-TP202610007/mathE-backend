# ── Builder ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm exec prisma generate
RUN pnpm build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install all deps (dev included — tsx required by seed script)
RUN pnpm install --frozen-lockfile

# Compiled app
COPY --from=builder /app/dist ./dist

# Generated Prisma client (built in builder stage)
COPY --from=builder /app/src/generated ./src/generated

# Prisma directory: schema, migrations, seed script, seed data
COPY prisma ./prisma

# Source files imported by seed.ts at runtime via tsx
COPY src/config ./src/config
COPY src/domain ./src/domain

COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 3000

CMD ["sh", "start.sh"]
