import { DatabaseHealthAdapter } from "../../adapters/database-health.adapter.js";
import {
  AiAvailabilityStatus,
  AiAvailabilityTracker,
} from "../../adapters/ai-availability-tracker.adapter.js";

export interface HealthStatus {
  status: "ok" | "degraded";
  db: "up" | "down";
  /**
   * HU-47: last known state of AI question generation, taken from recent
   * generation outcomes (no AI call). It never degrades `status`.
   */
  aiGeneration: { status: AiAvailabilityStatus; since: string | null };
}

export class CheckHealthUseCase {
  constructor(
    private readonly databaseHealth: DatabaseHealthAdapter,
    private readonly aiAvailability: AiAvailabilityTracker | null = null,
  ) {}

  async execute(): Promise<HealthStatus> {
    const aiGeneration = this.aiGenerationState();
    try {
      await this.databaseHealth.ping();
      return { status: "ok", db: "up", aiGeneration };
    } catch (err) {
      console.error(
        "[health] database ping failed:",
        err instanceof Error ? err.message : String(err),
      );
      return { status: "degraded", db: "down", aiGeneration };
    }
  }

  private aiGenerationState(): HealthStatus["aiGeneration"] {
    const state = this.aiAvailability?.current();
    if (!state) return { status: "unknown", since: null };
    return { status: state.status, since: state.since?.toISOString() ?? null };
  }
}
