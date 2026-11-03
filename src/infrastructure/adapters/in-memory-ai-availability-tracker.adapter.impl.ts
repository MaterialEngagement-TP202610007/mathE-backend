import {
  AiAvailabilityState,
  AiAvailabilityTracker,
} from "../../domain/adapters/ai-availability-tracker.adapter.js";

/**
 * Process-local AI availability state (HU-47). It resets to "unknown" on
 * restart and is per instance, which is enough for a single-instance deploy.
 */
export class InMemoryAiAvailabilityTracker implements AiAvailabilityTracker {
  private state: AiAvailabilityState = { status: "unknown", since: null };

  constructor(private readonly now: () => Date = () => new Date()) {}

  recordSuccess(): boolean {
    if (this.state.status === "available") return false;
    const endsOutage = this.state.status === "unavailable";
    this.state = { status: "available", since: this.now() };
    return endsOutage;
  }

  recordFailure(): boolean {
    if (this.state.status === "unavailable") return false;
    this.state = { status: "unavailable", since: this.now() };
    return true;
  }

  current(): AiAvailabilityState {
    return { ...this.state };
  }
}

/** Shared by question generation (writer) and the health check (reader). */
export const aiAvailabilityTracker = new InMemoryAiAvailabilityTracker();
