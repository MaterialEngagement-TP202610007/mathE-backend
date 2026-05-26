import { Router } from "express";
import { MLDatasetController } from "../controllers/ml-dataset.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleGuard } from "../middlewares/role.middleware.js";
import { ROLES } from "../../domain/constants/roles.constant.js";
import { MLDatasetRepositoryImpl } from "../../infrastructure/repositories/ml-dataset.repository.impl.js";
import { GetDatasetUseCase } from "../../domain/use-cases/ml-dataset/get-dataset.use-case.js";
import { GetDatasetEntryUseCase } from "../../domain/use-cases/ml-dataset/get-dataset-entry.use-case.js";

export class MLDatasetRoutes {
  static get routes(): Router {
    const router = Router();

    const mlDatasetRepository = new MLDatasetRepositoryImpl();

    const controller = new MLDatasetController(
      new GetDatasetUseCase(mlDatasetRepository),
      new GetDatasetEntryUseCase(mlDatasetRepository),
    );

    router.use(authMiddleware);
    router.use(roleGuard(ROLES.TEACHER, ROLES.ADMIN));

    /**
     * @openapi
     * /api/ml-dataset:
     *   get:
     *     tags: [MLDataset]
     *     summary: List all ML dataset entries (paginated). Teacher/Admin only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 20 }
     *       - in: query
     *         name: studentId
     *         schema: { type: integer }
     *       - in: query
     *         name: gradeId
     *         schema: { type: integer }
     *       - in: query
     *         name: schoolId
     *         schema: { type: integer }
     *       - in: query
     *         name: labelSource
     *         schema: { type: string, enum: [simple_score, teacher_validated] }
     *       - in: query
     *         name: includedInTraining
     *         schema: { type: boolean }
     *     responses:
     *       200: { description: Paginated dataset entries }
     */
    router.get("/", controller.listAll);

    /**
     * @openapi
     * /api/ml-dataset/{id}:
     *   get:
     *     tags: [MLDataset]
     *     summary: Get a single dataset entry by id. Teacher/Admin only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200: { description: Dataset entry detail }
     *       404: { description: Not found }
     */
    router.get("/:id", controller.getById);

    return router;
  }
}
