import { Router } from "express";
import { HealthController } from "../controllers/health.controller.js";
import { CheckHealthUseCase } from "../../domain/use-cases/health/check-health.use-case.js";
import { PrismaDatabaseHealthAdapter } from "../../infrastructure/adapters/prisma-database-health.adapter.impl.js";
import { aiAvailabilityTracker } from "../../infrastructure/adapters/in-memory-ai-availability-tracker.adapter.impl.js";

export class HealthRoutes {
  static get routes(): Router {
    const router = Router();

    const controller = new HealthController(
      new CheckHealthUseCase(
        new PrismaDatabaseHealthAdapter(),
        aiAvailabilityTracker,
      ),
    );

    /**
     * @openapi
     * /api/health:
     *   get:
     *     tags: [Health]
     *     summary: Liveness + database check. No auth, not rate limited.
     *     description: >
     *       Runs a trivial database query. Use as the Render health check path.
     *       Also reports aiGeneration (HU-47) without calling the AI service.
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
     *                 aiGeneration:
     *                   type: object
     *                   description: >
     *                     HU-47. Last known state of AI question generation, derived from
     *                     recent generation outcomes (no AI call is made). Never affects
     *                     status or the HTTP code. Resets to unknown on restart.
     *                   properties:
     *                     status: { type: string, enum: [available, unavailable, unknown] }
     *                     since: { type: string, format: date-time, nullable: true }
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
