import { prisma } from "../../config/database/index.js";
import { DatabaseHealthAdapter } from "../../domain/adapters/database-health.adapter.js";

const PING_TIMEOUT_MS = 3000;

export class PrismaDatabaseHealthAdapter implements DatabaseHealthAdapter {
  async ping(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Database ping timed out after ${PING_TIMEOUT_MS} ms`)),
        PING_TIMEOUT_MS,
      );
    });

    try {
      await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
