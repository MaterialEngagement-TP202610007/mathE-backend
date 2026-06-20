import { Router } from "express";
import { ResultController } from "../controllers/result.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleGuard } from "../middlewares/role.middleware.js";
import { ROLES } from "../../domain/constants/roles.constant.js";
import { ResultRepositoryImpl } from "../../infrastructure/repositories/result.repository.impl.js";
import { GetResultUseCase } from "../../domain/use-cases/result/get-result.use-case.js";
import { GetResultByQuestionnaireUseCase } from "../../domain/use-cases/result/get-result-by-questionnaire.use-case.js";
import { GetStudentResultsUseCase } from "../../domain/use-cases/result/get-student-results.use-case.js";
import { GetAllResultsUseCase } from "../../domain/use-cases/result/get-all-results.use-case.js";
import { CorrectResultLabelUseCase } from "../../domain/use-cases/result/correct-result-label.use-case.js";
import { GetSchoolStatsUseCase } from "../../domain/use-cases/result/get-school-stats.use-case.js";
import { GetStatsByGradeUseCase } from "../../domain/use-cases/result/get-stats-by-grade.use-case.js";

export class ResultRoutes {
  static get routes(): Router {
    const router = Router();

    const resultRepository = new ResultRepositoryImpl();

    const controller = new ResultController(
      new GetResultUseCase(resultRepository),
      new GetResultByQuestionnaireUseCase(resultRepository),
      new GetStudentResultsUseCase(resultRepository),
      new GetAllResultsUseCase(resultRepository),
      new CorrectResultLabelUseCase(resultRepository),
      new GetSchoolStatsUseCase(resultRepository),
      new GetStatsByGradeUseCase(resultRepository),
    );

    router.use(authMiddleware);

    /**
     * @openapi
     * /api/results:
     *   get:
     *     tags: [Results]
     *     summary: List all results (Teacher/Admin). Supports filters by studentId, gradeId, schoolId, classifierType.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 10 }
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
     *         name: classifierType
     *         schema: { type: string }
     *     responses:
     *       200: { description: Paginated results }
     */
    router.get(
      "/",
      roleGuard(ROLES.TEACHER, ROLES.ADMIN),
      controller.listAll,
    );

    /**
     * @openapi
     * /api/results/my:
     *   get:
     *     tags: [Results]
     *     summary: List the authenticated student's results (paginated). Student only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 10 }
     *       - in: query
     *         name: startDate
     *         schema: { type: string, format: date }
     *         description: Filter results from this date (ISO 8601, e.g. 2025-01-01)
     *       - in: query
     *         name: endDate
     *         schema: { type: string, format: date }
     *         description: Filter results up to this date (ISO 8601, e.g. 2025-12-31)
     *       - in: query
     *         name: predominantStyle
     *         schema: { type: string, enum: [Visual, Auditory, Kinesthetic] }
     *         description: Filter by predominant VAK style
     *     responses:
     *       200: { description: Paginated results }
     *       400: { description: Invalid query params }
     */
    router.get("/my", roleGuard(ROLES.STUDENT), controller.listMine);

    /**
     * @openapi
     * /api/results/questionnaire/{questionnaireId}:
     *   get:
     *     tags: [Results]
     *     summary: Get result for a specific questionnaire.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: questionnaireId
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200: { description: Result for questionnaire }
     *       404: { description: No result found }
     */
    router.get(
      "/questionnaire/:questionnaireId",
      roleGuard(ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN),
      controller.getByQuestionnaire,
    );

    /**
     * @openapi
     * /api/results/stats/school/{schoolId}:
     *   get:
     *     tags: [Results]
     *     summary: School-level result summary. Teacher/Admin only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: schoolId
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200: { description: School stats }
     *       400: { description: Invalid schoolId }
     */
    router.get(
      "/stats/school/:schoolId",
      roleGuard(ROLES.TEACHER, ROLES.ADMIN),
      controller.getSchoolStats,
    );

    /**
     * @openapi
     * /api/results/stats/school/{schoolId}/by-grade:
     *   get:
     *     tags: [Results]
     *     summary: Average VAK probabilities per academic grade for a school. Teacher/Admin only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: schoolId
     *         required: true
     *         schema: { type: integer }
     *       - in: query
     *         name: level
     *         schema: { type: string, enum: [Primaria, Secundaria] }
     *         description: Filter grades by education level
     *     responses:
     *       200: { description: Array of per-grade VAK stats }
     *       400: { description: Invalid schoolId or level }
     */
    router.get(
      "/stats/school/:schoolId/by-grade",
      roleGuard(ROLES.TEACHER, ROLES.ADMIN),
      controller.getStatsByGrade,
    );

    /**
     * @openapi
     * /api/results/{id}:
     *   get:
     *     tags: [Results]
     *     summary: Get result by id. Student can only access their own results.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200: { description: Result detail }
     *       403: { description: Result does not belong to you }
     *       404: { description: Not found }
     */
    router.get(
      "/:id",
      roleGuard(ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN),
      controller.getById,
    );

    /**
     * @openapi
     * /api/results/{id}/correct-label:
     *   patch:
     *     tags: [Results]
     *     summary: Correct the VAK label for a result (pilot phase). Teacher/Admin only.
     *     description: >
     *       Updates correctedVakLabel on the Result and sets vakLabel + labelSource=teacher_validated
     *       on the corresponding MLDataset row. Used during the pilot phase to build Ground Truth.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [vakLabel]
     *             properties:
     *               vakLabel:
     *                 type: string
     *                 enum: [Visual, Auditory, Kinesthetic]
     *     responses:
     *       200: { description: Result with corrected label }
     *       400: { description: Invalid vakLabel }
     *       404: { description: Result not found }
     */
    router.patch(
      "/:id/correct-label",
      roleGuard(ROLES.TEACHER, ROLES.ADMIN),
      controller.correctLabel,
    );

    return router;
  }
}
