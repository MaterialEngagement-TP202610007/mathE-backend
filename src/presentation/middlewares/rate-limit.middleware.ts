import { Request, RequestHandler } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";

/*
 * All production traffic arrives through the Netlify proxy, so many users share
 * a handful of IPs. Limits are keyed by account identity instead, with the IP
 * only as a fallback.
 */

function ipKey(req: Request): string {
  return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}

/** Auth endpoints: key by the normalized email in the body. */
export function emailOrIpKey(req: Request): string {
  const email = req.body?.email;
  if (typeof email === "string" && email.trim()) {
    return `email:${email.trim().toLowerCase()}`;
  }
  return ipKey(req);
}

/** Authenticated endpoints: key by user id. */
export function userOrIpKey(req: Request): string {
  return req.user ? `user:${req.user.id}` : ipKey(req);
}

interface RateLimiterOptions {
  windowMs: number;
  limit: number;
  keyGenerator: (req: Request) => string;
  message: string;
  skipSuccessfulRequests?: boolean;
}

export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    keyGenerator: options.keyGenerator,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Keys never rely on the forwarded client IP, so the proxy checks are noise.
    validate: {
      trustProxy: false,
      xForwardedForHeader: false,
      keyGeneratorIpFallback: false,
    },
    handler: (_req, res, _next, opts) => {
      res.status(opts.statusCode).json({ error: options.message });
    },
  });
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;

export const loginRateLimiter = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  keyGenerator: emailOrIpKey,
  // Only failed logins count, so a legitimate user is not locked out by retries.
  skipSuccessfulRequests: true,
  message: "Too many login attempts, please try again in 15 minutes",
});

export const registerRateLimiter = createRateLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  keyGenerator: emailOrIpKey,
  message: "Too many registration attempts, please try again in 15 minutes",
});

export const questionGenerationRateLimiter = createRateLimiter({
  windowMs: TEN_MINUTES,
  limit: 10,
  keyGenerator: userOrIpKey,
  message: "Too many question generation requests, please try again in 10 minutes",
});
