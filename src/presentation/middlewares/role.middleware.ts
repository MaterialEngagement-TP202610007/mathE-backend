import { NextFunction, Request, Response } from "express";

/**
 * RBAC guard. Allows the request through only if `req.user.roleId` is one of
 * `allowedRoles`. Requires `authMiddleware` to have run first.
 */
export const roleGuard = (...allowedRoles: number[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (req.user.roleId === null || req.user.roleId === undefined) {
      return res.status(403).json({ error: "No role assigned" });
    }
    if (!allowedRoles.includes(req.user.roleId)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
};

/**
 * Allows the action if the authenticated user is acting on their own resource
 * (`:id` param matches their user id) OR if their role is in `allowedRoles`.
 * Useful for "self or admin" style routes (e.g. update profile).
 */
export const selfOrRoleGuard = (...allowedRoles: number[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const targetId = Number(req.params.id);
    if (!isNaN(targetId) && targetId === req.user.id) return next();

    if (
      req.user.roleId !== null &&
      req.user.roleId !== undefined &&
      allowedRoles.includes(req.user.roleId)
    ) {
      return next();
    }

    return res.status(403).json({ error: "Insufficient permissions" });
  };
};
