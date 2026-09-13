import { Router } from "express";
import { HealthController } from "../controllers/health.controller.js";
import { CheckHealthUseCase } from "../../domain/use-cases/health/check-health.use-case.js";
import { PrismaDatabaseHealthAdapter } from "../../infrastructure/adapters/prisma-database-health.adapter.impl.js";

export class HealthRoutes {
  static get routes(): Router {
    const router = Router();

    const controller = new HealthController(
      new CheckHealthUseCase(new PrismaDatabaseHealthAdapter()),
    );

    /**
     * @openapi
     * /api/health:
     *   get:
     *     tags: [Health]
     *     summary: Liveness + database check. No auth, not rate limited.
     *     description: Runs a trivial database query. Use as the Render health check path.
     *     responses:
     *       200:
     *         description: Service and database are up
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status: { type: string, example: ok }
     *                 db: { type: string, example: up }
     *       503:
     *         description: Database unreachable
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status: { type: string, example: degraded }
     *                 db: { type: string, example: down }
     */
    router.get("/", controller.check);

    return router;
  }
}
