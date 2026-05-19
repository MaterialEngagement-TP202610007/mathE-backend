import { NextFunction, Request, Response } from "express";
import { CustomError } from "../../domain/error/custom-error.js";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof CustomError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
};
