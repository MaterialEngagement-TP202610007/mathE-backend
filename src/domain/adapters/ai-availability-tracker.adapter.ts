export type AiAvailabilityStatus = "available" | "unavailable" | "unknown";

export interface AiAvailabilityState {
  status: AiAvailabilityStatus;
  /** When the current status started; null while nothing has been observed. */
  since: Date | null;
}

/**
 * Port that remembers whether the AI generation service is reachable (HU-47).
 * Fed by question generation outcomes only, so reading it never costs an AI call.
 */
export abstract class AiAvailabilityTracker {
  /** Records an AI answer. Returns true when it ends an outage. */
  abstract recordSuccess(): boolean;
  /** Records a failed AI call. Returns true when it starts an outage. */
  abstract recordFailure(): boolean;
  abstract current(): AiAvailabilityState;
}
