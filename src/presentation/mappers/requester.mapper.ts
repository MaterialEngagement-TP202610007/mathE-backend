import { Request } from "express";
import { Requester } from "../../domain/interfaces/shared/requester.interface.js";

/** Authenticated caller identity for use cases. Requires `authMiddleware`. */
export function toRequester(req: Request): Requester {
  return { id: req.user!.id, roleId: req.user!.roleId ?? null };
}
