import { NextFunction, Request, Response } from "express";

// Health checks run every few seconds on Render — keep them out of the logs.
const SILENT_PATHS = new Set(["/api/health"]);

/** Logs method, path, status and duration once the response is finished. */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  if (SILENT_PATHS.has(req.path)) return next();

  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });
  next();
};
