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

/** User as returned by `/api/auth/*` — school nested as `{ id, name }`. */
export function toAuthUser(user: UserEntity): AuthUser {
  const { schoolId, schoolName, ...rest } = toPublicUser(user);
  return {
    ...rest,
    school: schoolId ? { id: schoolId, name: schoolName ?? null } : null,
  };
}
