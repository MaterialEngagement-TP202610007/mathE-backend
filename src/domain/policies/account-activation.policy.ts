import { ROLES } from "../constants/roles.constant.js";

/**
 * Account activation rules:
 * - Students are active as soon as they register.
 * - Teachers register inactive and must be approved (activated) by an admin.
 *
 * Every inactive-account message starts with "Account is inactive" — the
 * frontend matches that prefix.
 */
export const INACTIVE_ACCOUNT_MESSAGE =
  "Account is inactive. Contact an administrator.";

export const INACTIVE_TEACHER_MESSAGE =
  "Account is inactive. Your teacher account is pending administrator approval.";

export function isActiveOnRegistration(roleId: number): boolean {
  return roleId === ROLES.STUDENT;
}

export function requiresActivation(roleId: number | null): boolean {
  return roleId === ROLES.TEACHER;
}

export function inactiveAccountMessage(user: {
  roleId: number | null;
  deletedAt: Date | null;
}): string {
  return requiresActivation(user.roleId) && !user.deletedAt
    ? INACTIVE_TEACHER_MESSAGE
    : INACTIVE_ACCOUNT_MESSAGE;
}
