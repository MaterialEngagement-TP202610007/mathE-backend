/** Port for a cheap database liveness probe. Resolves when reachable, rejects otherwise. */
export abstract class DatabaseHealthAdapter {
  abstract ping(): Promise<void>;
}
