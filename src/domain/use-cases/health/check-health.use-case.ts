import { DatabaseHealthAdapter } from "../../adapters/database-health.adapter.js";

export interface HealthStatus {
  status: "ok" | "degraded";
  db: "up" | "down";
}

export class CheckHealthUseCase {
  constructor(private readonly databaseHealth: DatabaseHealthAdapter) {}

  async execute(): Promise<HealthStatus> {
    try {
      await this.databaseHealth.ping();
      return { status: "ok", db: "up" };
    } catch (err) {
      console.error(
        "[health] database ping failed:",
        err instanceof Error ? err.message : String(err),
      );
      return { status: "degraded", db: "down" };
    }
  }
}
