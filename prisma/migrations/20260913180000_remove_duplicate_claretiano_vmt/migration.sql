-- Remove the duplicate school CLARETIANO - VILLA MARIA DEL TRIUNFO
-- (institutionKey 'LOC-347708-CLARETIANO', codMods 0825018 / 1267541) so students
-- only see one Claretiano: the demo school CLARETIANO - SAN MIGUEL
-- (institutionKey 'LOC-337988-CLARETIANO', codMods 0331041 / 0336743).
--
-- Rows are matched by institutionKey because ids differ between environments.
-- The school is also excluded from the data file (EXCLUDED_INSTITUTION_KEYS in
-- prisma/scripts/school-grouping.ts), so the seed never recreates it.
--
-- Behavior (idempotent, safe on an empty database):
--   * Both schools exist: users and questions pointing to the Villa Maria del
--     Triunfo row are repointed to the San Miguel row, then the row is deleted.
--   * Only Villa Maria del Triunfo exists (unexpected): the repoint joins match
--     nothing and the row is deleted; the FKs (ON DELETE SET NULL) clear the
--     schoolId of any user/question that pointed to it.
--   * Villa Maria del Triunfo does not exist: every statement is a no-op.
--
-- Prisma 7 does not wrap PostgreSQL migrations in a transaction, so the
-- migration is wrapped explicitly: a failure leaves the database untouched.

BEGIN;

UPDATE "User" AS u
SET "schoolId" = keep."id"
FROM "School" AS dup, "School" AS keep
WHERE dup."institutionKey" = 'LOC-347708-CLARETIANO'
  AND keep."institutionKey" = 'LOC-337988-CLARETIANO'
  AND u."schoolId" = dup."id";

UPDATE "Question" AS q
SET "schoolId" = keep."id"
FROM "School" AS dup, "School" AS keep
WHERE dup."institutionKey" = 'LOC-347708-CLARETIANO'
  AND keep."institutionKey" = 'LOC-337988-CLARETIANO'
  AND q."schoolId" = dup."id";

DELETE FROM "School"
WHERE "institutionKey" = 'LOC-347708-CLARETIANO';

COMMIT;
