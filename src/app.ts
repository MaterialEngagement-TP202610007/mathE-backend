import { envs } from "./config/envs.js";
import { prisma } from "./config/database/index.js";
import { Server } from "./presentation/server.js";
import { AppRoutes } from "./presentation/routes/index.js";
import { sseNotificationService } from "./infrastructure/services/sse-notification.service.js";

const FORCE_EXIT_TIMEOUT_MS = 10_000;

process.on("unhandledRejection", (reason) => {
  console.error("[process] Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[process] Uncaught exception:", err);
  process.exit(1);
});

main().catch((err) => {
  console.error("[boot] Failed to start server:", err);
  process.exit(1);
});

async function main() {
  const server = new Server({
    port: envs.PORT,
    routes: AppRoutes.routes,
  });

  await server.start();

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] ${signal} received, closing server...`);

    const forceExit = setTimeout(() => {
      console.error("[shutdown] Timed out, forcing exit");
      process.exit(1);
    }, FORCE_EXIT_TIMEOUT_MS);
    forceExit.unref();

    try {
      // SSE streams never finish on their own, so end them before closing.
      const closing = server.stop();
      sseNotificationService.closeAll();
      await closing;
      await prisma.$disconnect();
      console.log("[shutdown] Clean exit");
      process.exit(0);
    } catch (err) {
      console.error("[shutdown] Error during shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
