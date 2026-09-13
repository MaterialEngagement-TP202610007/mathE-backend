-- Students no longer require activation: only teachers are approved by an admin.
-- Activate students created inactive under the previous rule so they can log in.
-- Soft-deleted users stay inactive. Idempotent.

BEGIN;

UPDATE "User"
SET "isActive" = true
WHERE "roleId" = 3
  AND "isActive" = false
  AND "deletedAt" IS NULL;

COMMIT;
