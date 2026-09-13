import { UserEntity } from "../../domain/entities/user.entity.js";

export type PublicUser = Omit<UserEntity, "password">;

export type AuthUser = Omit<PublicUser, "schoolId" | "schoolName"> & {
  school: { id: number; name: string | null } | null;
};

/** User as returned by `/api/users/*` — never includes the password hash. */
export function toPublicUser(user: UserEntity): PublicUser {
  const { password: _password, ...rest } = user;
  return rest;
}

export type PublicUserWithSchool = PublicUser & {
  school: { id: number; name: string | null } | null;
};

/**
 * Public user plus a nested `school: { id, name } | null`. Additive: the flat
 * `schoolId` / `schoolName` fields are kept for existing callers.
 */
export function toPublicUserWithSchool(user: UserEntity): PublicUserWithSchool {
  const publicUser = toPublicUser(user);
  return { ...publicUser, school: nestSchool(publicUser) };
}

/** User as returned by `/api/auth/*` — school nested as `{ id, name }`. */
export function toAuthUser(user: UserEntity): AuthUser {
  const { schoolId, schoolName, ...rest } = toPublicUser(user);
  return {
    ...rest,
    school: nestSchool({ schoolId, schoolName }),
  };
}

function nestSchool(user: {
  schoolId: number | null;
  schoolName: string | null;
}): { id: number; name: string | null } | null {
  return user.schoolId
    ? { id: user.schoolId, name: user.schoolName ?? null }
    : null;
}
