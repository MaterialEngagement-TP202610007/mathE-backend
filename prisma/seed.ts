/**
 * Prisma seed script — runs automatically on `prisma migrate dev`,
 * `prisma migrate reset`, and manually via `pnpm exec prisma db seed`.
 *
 * Idempotent: every role is upserted by stable id, so re-runs update
 * `description`/`status` without creating duplicates.
 *
 * Ids here MUST match `src/domain/constants/roles.constant.ts`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { envs } from "../src/config/envs.js";
import { ROLES } from "../src/domain/constants/roles.constant.js";

const adapter = new PrismaPg({ connectionString: envs.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const defaultRoles = [
  { id: ROLES.ADMIN, description: "admin" },
  { id: ROLES.TEACHER, description: "teacher" },
  { id: ROLES.STUDENT, description: "student" },
];

async function main() {
  for (const role of defaultRoles) {
    await prisma.roles.upsert({
      where: { id: role.id },
      update: { description: role.description, status: true },
      create: { id: role.id, description: role.description, status: true },
    });
  }

  // Re-sync the autoincrement sequence so future inserts pick the next free id.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Roles"', 'id'), GREATEST((SELECT COALESCE(MAX("id"), 0) FROM "Roles"), 1));`,
  );

  console.log(`Seeded ${defaultRoles.length} roles.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
