/**
 * Default role ids — kept in sync with the seed migration
 * `prisma/migrations/20260519120000_seed_default_roles/migration.sql`.
 *
 * Use these constants in use cases / middlewares (RBAC) instead of
 * hard-coding numeric ids.
 */
export const ROLES = {
  ADMIN: 1,
  TEACHER: 2,
  STUDENT: 3,
} as const;

export type RoleId = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_NAMES: Record<RoleId, string> = {
  [ROLES.ADMIN]: "admin",
  [ROLES.TEACHER]: "teacher",
  [ROLES.STUDENT]: "student",
};
