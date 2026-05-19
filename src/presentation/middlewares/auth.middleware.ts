import { NextFunction, Request, Response } from "express";
import { JwtAdapter } from "../../infrastructure/adapters/jwt.adapter.impl.js";
import { TokenPayload } from "../../domain/adapters/token.adapter.js";

const tokenAdapter = new JwtAdapter();

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authorization = req.header("Authorization");
  if (!authorization) {
    return res.status(401).json({ error: "No token provided" });
  }
  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Invalid token format" });
  }

  const token = authorization.split(" ")[1];
  const payload = await tokenAdapter.verify(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = payload;
  next();
};
