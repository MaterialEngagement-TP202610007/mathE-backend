/**
 * Prisma seed script — runs automatically on `prisma migrate dev`,
 * `prisma migrate reset`, and manually via `pnpm exec prisma db seed`.
 *
 * Idempotent: each row is upserted by stable id, so re-runs update
 * descriptive fields without creating duplicates.
 *
 * Role ids MUST match `src/domain/constants/roles.constant.ts`.
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

// Peruvian school structure (Colegio Claretiano):
// 6 grades of Primaria + 5 grades of Secundaria.
const defaultAcademicGrades = [
  { id: 1, name: "1ro Primaria", level: "Primaria", order: 1 },
  { id: 2, name: "2do Primaria", level: "Primaria", order: 2 },
  { id: 3, name: "3ro Primaria", level: "Primaria", order: 3 },
  { id: 4, name: "4to Primaria", level: "Primaria", order: 4 },
  { id: 5, name: "5to Primaria", level: "Primaria", order: 5 },
  { id: 6, name: "6to Primaria", level: "Primaria", order: 6 },
  { id: 7, name: "1ro Secundaria", level: "Secundaria", order: 7 },
  { id: 8, name: "2do Secundaria", level: "Secundaria", order: 8 },
  { id: 9, name: "3ro Secundaria", level: "Secundaria", order: 9 },
  { id: 10, name: "4to Secundaria", level: "Secundaria", order: 10 },
  { id: 11, name: "5to Secundaria", level: "Secundaria", order: 11 },
];

async function seedRoles() {
  for (const role of defaultRoles) {
    await prisma.roles.upsert({
      where: { id: role.id },
      update: { description: role.description, status: true },
      create: { id: role.id, description: role.description, status: true },
    });
  }
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Roles"', 'id'), GREATEST((SELECT COALESCE(MAX("id"), 0) FROM "Roles"), 1));`,
  );
  console.log(`Seeded ${defaultRoles.length} roles.`);
}

async function seedAcademicGrades() {
  for (const grade of defaultAcademicGrades) {
    await prisma.academicGrade.upsert({
      where: { id: grade.id },
      update: { name: grade.name, level: grade.level, order: grade.order },
      create: grade,
    });
  }
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"AcademicGrade"', 'id'), GREATEST((SELECT COALESCE(MAX("id"), 0) FROM "AcademicGrade"), 1));`,
  );
  console.log(`Seeded ${defaultAcademicGrades.length} academic grades.`);
}

async function main() {
  await seedRoles();
  await seedAcademicGrades();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
