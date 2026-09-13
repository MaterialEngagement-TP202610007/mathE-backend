import { NextFunction, Request, Response } from "express";
import { CustomError } from "../../domain/error/custom-error.js";

const INTERNAL_ERROR = "Internal server error";

/**
 * Prisma known request errors, matched by duck typing so presentation never
 * imports Prisma. Unlisted codes fall through to a generic 500.
 */
const PRISMA_ERROR_MAP: Record<string, { status: number; message: string }> = {
  P2002: { status: 409, message: "Resource already exists" },
  P2003: { status: 400, message: "Referenced resource does not exist" },
  P2025: { status: 404, message: "Resource not found" },
  P2028: { status: 503, message: "Database is busy, please retry" },
};

interface HttpLikeError {
  type?: unknown;
  status?: unknown;
  statusCode?: unknown;
  expose?: unknown;
  code?: unknown;
  message?: unknown;
}

function asObject(err: unknown): HttpLikeError {
  return typeof err === "object" && err !== null ? (err as HttpLikeError) : {};
}

function clientErrorStatus(err: HttpLikeError): number | null {
  const status = err.status ?? err.statusCode;
  return typeof status === "number" && status >= 400 && status < 500
    ? status
    : null;
}

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Streaming/early responses (e.g. SSE, 202 jobs): let Express close the socket.
  if (res.headersSent) return next(err);

  const timestamp = new Date().toISOString();
  const route = `${req.method} ${req.originalUrl}`;

  if (err instanceof CustomError) {
    // Expected, handled errors: log a compact line without a stack trace.
    console.error(
      `[${timestamp}] ${route} -> ${err.statusCode} ${err.message}`,
    );
    return res.status(err.statusCode).json({ error: err.message });
  }

  const e = asObject(err);

  // body-parser / http-errors
  if (e.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON body" });
  }
  if (e.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large" });
  }
  const clientStatus = clientErrorStatus(e);
  if (clientStatus !== null) {
    const message =
      e.expose === true && typeof e.message === "string" && e.message
        ? e.message
        : "Bad request";
    return res.status(clientStatus).json({ error: message });
  }

  if (typeof e.code === "string" && /^P\d{4}$/.test(e.code)) {
    const mapped = PRISMA_ERROR_MAP[e.code];
    console.error(
      `[${timestamp}] ${route} -> ${mapped?.status ?? 500} Prisma ${e.code}:`,
      e.message,
    );
    if (mapped) return res.status(mapped.status).json({ error: mapped.message });
    return res.status(500).json({ error: INTERNAL_ERROR });
  }

  // Unknown / unexpected errors: log the full error (with stack) server-side only.
  console.error(`[${timestamp}] ${route} -> 500 Unhandled error:`, err);

  return res.status(500).json({ error: INTERNAL_ERROR });
};

/** JSON 404 for routes that no router handled. */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
};
