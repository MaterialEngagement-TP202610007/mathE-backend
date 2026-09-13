/**
 * Prisma seed script — runs automatically on `prisma migrate dev`,
 * `prisma migrate reset`, and manually via `pnpm exec prisma db seed`.
 *
 * Idempotent: roles/grades are upserted by stable id and schools by
 * `institutionKey`, so re-runs update descriptive fields without creating
 * duplicates.
 *
 * Role ids MUST match `src/domain/constants/roles.constant.ts`.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { envs } from "../src/config/envs.js";
import { ROLES } from "../src/domain/constants/roles.constant.js";
import { SCHOOLS, SchoolSeed } from "./data/schools.generated.js";
import { runAdminBootstrap } from "./admin-bootstrap.js";

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

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

function schoolChanged(current: SchoolSeed, next: SchoolSeed): boolean {
  return (
    current.cenEdu !== next.cenEdu ||
    current.district !== next.district ||
    current.address !== next.address ||
    current.businessName !== next.businessName ||
    !sameList(current.levels, next.levels) ||
    !sameList(current.codMods, next.codMods)
  );
}

/**
 * Upserts schools by `institutionKey` (one row per real school). Existing rows
 * are loaded once and compared in memory, so a re-run only inserts new schools
 * and updates the ones whose aggregated fields changed.
 */
async function seedSchools() {
  const CHUNK = 500;

  const existing = await prisma.school.findMany({
    select: {
      institutionKey: true,
      cenEdu: true,
      district: true,
      address: true,
      businessName: true,
      levels: true,
      codMods: true,
    },
  });
  const byKey = new Map(existing.map((s) => [s.institutionKey, s]));

  const toCreate = SCHOOLS.filter((s) => !byKey.has(s.institutionKey));
  const toUpdate = SCHOOLS.filter((s) => {
    const current = byKey.get(s.institutionKey);
    return current !== undefined && schoolChanged(current, s);
  });

  let inserted = 0;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const res = await prisma.school.createMany({
      data: toCreate.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    inserted += res.count;
  }

  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    await prisma.$transaction(
      toUpdate.slice(i, i + CHUNK).map(({ institutionKey, ...data }) =>
        prisma.school.update({ where: { institutionKey }, data }),
      ),
    );
  }

  console.log(
    `Seeded schools: ${inserted} inserted, ${toUpdate.length} updated, ` +
      `${SCHOOLS.length - toCreate.length - toUpdate.length} unchanged (${SCHOOLS.length} total).`,
  );
}

async function main() {
  await seedRoles();
  await seedAcademicGrades();
  await seedSchools();
  // Runs last: needs the ADMIN role. Skipped when ADMIN_* vars are unset.
  await runAdminBootstrap(prisma);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
