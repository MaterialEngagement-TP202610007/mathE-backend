import { CustomError } from "../../domain/error/custom-error.js";

export interface FetchWithTimeoutInit extends RequestInit {
  timeoutMs: number;
  /** Human-readable name used in error messages (e.g. "Lambda"). */
  serviceName: string;
}

function isTimeout(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "TimeoutError" || err.name === "AbortError")
  );
}

/**
 * `fetch` bounded by `AbortSignal.timeout`. Network failures become 503 and
 * timeouts 504 CustomErrors so callers can fall back uniformly.
 */
export async function fetchWithTimeout(
  url: string,
  { timeoutMs, serviceName, ...init }: FetchWithTimeoutInit,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (isTimeout(err)) {
      throw CustomError.gatewayTimeout(
        `${serviceName} request timed out after ${timeoutMs} ms`,
      );
    }
    throw CustomError.serviceUnavailable(`${serviceName} request failed`);
  }
}

/** Parses a JSON body; malformed bodies become 502, body-read timeouts 504. */
export async function readJson<T = unknown>(
  response: Response,
  serviceName: string,
): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch (err) {
    if (isTimeout(err)) {
      throw CustomError.gatewayTimeout(`${serviceName} response timed out`);
    }
    throw CustomError.badGateway(`${serviceName} returned an invalid JSON body`);
  }
}

/** Maps a non-ok upstream status: 429 is preserved, everything else is 502. */
export function upstreamStatusError(
  response: Response,
  serviceName: string,
): CustomError {
  const message = `${serviceName} returned status ${response.status}`;
  return response.status === 429
    ? CustomError.tooManyRequests(message)
    : CustomError.badGateway(message);
}
