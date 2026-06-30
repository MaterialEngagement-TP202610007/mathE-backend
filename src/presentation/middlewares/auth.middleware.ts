import { NextFunction, Request, Response } from "express";
import { JwtAdapter } from "../../infrastructure/adapters/jwt.adapter.impl.js";

const tokenAdapter = new JwtAdapter();

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const cookieToken = req.cookies?.auth_token;
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  const token = cookieToken ?? bearerToken;
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const payload = await tokenAdapter.verify(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = payload;
  next();
};
