import { NextFunction, Request, Response } from "express";
import { CustomError } from "../../domain/error/custom-error.js";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const timestamp = new Date().toISOString();
  const route = `${req.method} ${req.originalUrl}`;

  if (err instanceof CustomError) {
    // Expected, handled errors: log a compact line so they're visible in dev
    // without spamming a full stack trace.
    console.error(
      `[${timestamp}] ${route} -> ${err.statusCode} ${err.message}`,
    );
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Unknown / unexpected errors: log the full object + stack trace.
  console.error(`[${timestamp}] ${route} -> 500 Unhandled error:`);
  console.error(err);
  if (err instanceof Error && err.stack) console.error(err.stack);

  return res.status(500).json({ error: "Internal server error" });
};
