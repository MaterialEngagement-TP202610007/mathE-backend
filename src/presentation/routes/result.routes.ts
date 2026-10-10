import { Router } from "express";
import { ResultController } from "../controllers/result.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleGuard } from "../middlewares/role.middleware.js";
import { ROLES } from "../../domain/constants/roles.constant.js";
import { ResultRepositoryImpl } from "../../infrastructure/repositories/result.repository.impl.js";
import { UserRepositoryImpl } from "../../infrastructure/repositories/user.repository.impl.js";
import { SchoolAccessPolicy } from "../../domain/policies/school-access.policy.js";
import { GetResultUseCase } from "../../domain/use-cases/result/get-result.use-case.js";
import { GetResultByQuestionnaireUseCase } from "../../domain/use-cases/result/get-result-by-questionnaire.use-case.js";
import { GetStudentResultsUseCase } from "../../domain/use-cases/result/get-student-results.use-case.js";
import { GetAllResultsUseCase } from "../../domain/use-cases/result/get-all-results.use-case.js";
import { CorrectResultLabelUseCase } from "../../domain/use-cases/result/correct-result-label.use-case.js";
import { GetSchoolStatsUseCase } from "../../domain/use-cases/result/get-school-stats.use-case.js";
import { GetStatsByGradeUseCase } from "../../domain/use-cases/result/get-stats-by-grade.use-case.js";
import { GetUserStatsUseCase } from "../../domain/use-cases/result/get-user-stats.use-case.js";
import { GetUserEvolutionUseCase } from "../../domain/use-cases/result/get-user-evolution.use-case.js";
import { ExportResultsUseCase } from "../../domain/use-cases/result/export-results.use-case.js";
import { GetSchoolStabilityUseCase } from "../../domain/use-cases/result/get-school-stability.use-case.js";

export class ResultRoutes {
  static get routes(): Router {
    const router = Router();

    const resultRepository = new ResultRepositoryImpl();
    const schoolAccessPolicy = new SchoolAccessPolicy(new UserRepositoryImpl());

    const controller = new ResultController(
      new GetResultUseCase(resultRepository),
      new GetResultByQuestionnaireUseCase(resultRepository),
      new GetStudentResultsUseCase(resultRepository),
      new GetAllResultsUseCase(resultRepository, schoolAccessPolicy),
      new CorrectResultLabelUseCase(resultRepository),
      new GetSchoolStatsUseCase(resultRepository, schoolAccessPolicy),
      new GetStatsByGradeUseCase(resultRepository, schoolAccessPolicy),
      new GetUserStatsUseCase(resultRepository),
      new GetUserEvolutionUseCase(resultRepository),
      new ExportResultsUseCase(resultRepository, schoolAccessPolicy),
      new GetSchoolStabilityUseCase(resultRepository, schoolAccessPolicy),
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
     *         description: Teachers may only filter by their own school.
     *       - in: query
     *         name: classifierType
     *         schema: { type: string }
     *       - in: query
     *         name: period
     *         schema: { type: string, enum: [week, month, quarter, year] }
     *         description: "HU-51. Relative range ending now (last 7 days, 1 month, 3 months, 1 year). An explicit from/to overrides that bound."
     *       - in: query
     *         name: from
     *         schema: { type: string, format: date }
     *         description: HU-51. Include results dated on or after this ISO date/timestamp.
     *       - in: query
     *         name: to
     *         schema: { type: string, format: date }
     *         description: HU-51. Include results dated on or before this ISO date/timestamp (a date-only value covers the whole day, UTC).
     *     responses:
     *       200: { description: Paginated results }
     *       400: { description: "Invalid period, from/to, or from > to" }
     *       403: { description: "Teacher requesting another school — { error: 'You can only access data from your own school' }" }
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
     *         description: Filter results up to this date, inclusive (a date-only value covers the whole day, UTC)
     *       - in: query
     *         name: predominantStyle
     *         schema: { type: string, enum: [Visual, Auditory, Kinesthetic] }
     *         description: Filter by predominant VAK style
     *       - in: query
     *         name: classifierType
     *         schema: { type: string }
     *         description: Filter by classifier type (e.g. xgboost)
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
     *     summary: School-level result summary. Admin (any school) or Teacher (own school only).
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: schoolId
     *         required: true
     *         schema: { type: integer }
     *       - in: query
     *         name: period
     *         schema: { type: string, enum: [week, month, quarter, year] }
     *         description: "HU-51. Relative range ending now (last 7 days, 1 month, 3 months, 1 year). An explicit from/to overrides that bound."
     *       - in: query
     *         name: from
     *         schema: { type: string, format: date }
     *         description: HU-51. Include results dated on or after this ISO date/timestamp.
     *       - in: query
     *         name: to
     *         schema: { type: string, format: date }
     *         description: HU-51. Include results dated on or before this ISO date/timestamp (a date-only value covers the whole day, UTC).
     *     responses:
     *       200:
     *         description: "School stats for the period (zero counts and null averages when the range has no data)"
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 schoolId: { type: integer }
     *                 evaluatedStudents: { type: integer }
     *                 mostCommonStyle: { type: string, nullable: true }
     *                 avgPredominantConfidence: { type: number, nullable: true }
     *                 startedQuestionnaires: { type: integer, description: "HU-50. Questionnaires started in the period (any status)" }
     *                 completedQuestionnaires: { type: integer, description: "HU-50. Started questionnaires that were completed" }
     *                 completionRate: { type: number, nullable: true, description: "HU-50. completed / started (0..1); null when nothing was started" }
     *                 avgResponseTimeSeconds: { type: number, nullable: true, description: "HU-50. Mean seconds per question over completed questionnaires (ML dataset avgQuestionTime); null when none completed" }
     *       400: { description: "Invalid schoolId, period, from/to, or from > to" }
     *       403: { description: "Teacher requesting another school — { error: 'You can only access data from your own school' }" }
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
     *     summary: Average VAK probabilities per academic grade for a school. Admin (any school) or Teacher (own school only).
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
     *       - in: query
     *         name: period
     *         schema: { type: string, enum: [week, month, quarter, year] }
     *         description: "HU-51. Relative range ending now (last 7 days, 1 month, 3 months, 1 year). An explicit from/to overrides that bound."
     *       - in: query
     *         name: from
     *         schema: { type: string, format: date }
     *         description: HU-51. Include results dated on or after this ISO date/timestamp.
     *       - in: query
     *         name: to
     *         schema: { type: string, format: date }
     *         description: HU-51. Include results dated on or before this ISO date/timestamp (a date-only value covers the whole day, UTC).
     *     responses:
     *       200:
     *         description: "Array of per-grade VAK stats for the period (every grade is listed; evaluatedStudents 0 when it has no results in range)"
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   gradeId: { type: integer }
     *                   gradeName: { type: string }
     *                   level: { type: string }
     *                   evaluatedStudents: { type: integer }
     *                   avgVisualProbability: { type: number, nullable: true }
     *                   avgAuditoryProbability: { type: number, nullable: true }
     *                   avgKinestheticProbability: { type: number, nullable: true }
     *                   styleCounts:
     *                     type: object
     *                     description: "HU-48. Students per predominant style of their latest result in the period (mixed profiles count under their predominant style); sums to evaluatedStudents."
     *                     properties:
     *                       Visual: { type: integer }
     *                       Auditory: { type: integer }
     *                       Kinesthetic: { type: integer }
     *       400: { description: "Invalid schoolId, level, period, from/to, or from > to" }
     *       403: { description: "Teacher requesting another school — { error: 'You can only access data from your own school' }" }
     */
    router.get(
      "/stats/school/:schoolId/by-grade",
      roleGuard(ROLES.TEACHER, ROLES.ADMIN),
      controller.getStatsByGrade,
    );

    /**
     * @openapi
     * /api/results/stats/school/{schoolId}/stability:
     *   get:
     *     tags: [Results]
     *     summary: Stability monitor — how each student's VAK classification varied in the period (HU-38). Admin (any school) or Teacher (own school only).
     *     description: >
     *       One entry per student with classified results in the period, ordered by grade, name and id.
     *       `changes` counts predominant-style changes between consecutive results (oldest first).
     *       `profile` is "stable" when the most frequent style covers at least 60% of the student's
     *       results, "variable" otherwise, and null when the student has a single result (no
     *       comparison available yet). No account or MVI data is included.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: schoolId
     *         required: true
     *         schema: { type: integer }
     *       - in: query
     *         name: gradeId
     *         schema: { type: integer }
     *         description: Only students of this academic grade
     *       - in: query
     *         name: period
     *         schema: { type: string, enum: [week, month, quarter, year] }
     *         description: "HU-51. Relative range ending now. An explicit from/to overrides that bound."
     *       - in: query
     *         name: from
     *         schema: { type: string, format: date }
     *       - in: query
     *         name: to
     *         schema: { type: string, format: date }
     *         description: A date-only value covers the whole day (UTC).
     *     responses:
     *       200:
     *         description: >
     *           { schoolId, gradeId | null, summary: { students, stable, variable, insufficientData },
     *           students: [{ studentId, studentName, gradeId, gradeName, resultsCount, firstStyle,
     *           lastStyle, changes, profile: "stable" | "variable" | null, lastResultDate }] }.
     *           An empty period returns students [] and a zero summary.
     *       400: { description: "Invalid schoolId, Invalid gradeId, or an invalid period" }
     *       403: { description: "Teacher requesting another school — { error: 'You can only access data from your own school' }" }
     */
    router.get(
      "/stats/school/:schoolId/stability",
      roleGuard(ROLES.TEACHER, ROLES.ADMIN),
      controller.getSchoolStability,
    );

    /**
     * @openapi
     * /api/results/export:
     *   get:
     *     tags: [Results]
     *     summary: Download a CSV of learning-style results by school, grade and period (HU-49). Admin (any school) or Teacher (own school only).
     *     description: >
     *       UTF-8 CSV with a BOM (Excel-friendly), comma separated, CRLF line endings, Spanish headers:
     *       Grado, Nivel, ID estudiante, Nombre del estudiante, Fecha del resultado, Estilo predominante,
     *       Confianza (%), Visual (%), Auditivo (%), Kinestésico (%), Perfil mixto, Estilo secundario, Clasificador.
     *       One row per result, ordered by grade, student name and date. Sections are not modelled.
     *       No account (email, password) or MVI data is included.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: query
     *         name: schoolId
     *         required: true
     *         schema: { type: integer }
     *       - in: query
     *         name: gradeId
     *         schema: { type: integer }
     *         description: Only students of this academic grade
     *       - in: query
     *         name: period
     *         schema: { type: string, enum: [week, month, quarter, year] }
     *         description: "HU-51. Relative range ending now. An explicit from/to overrides that bound."
     *       - in: query
     *         name: from
     *         schema: { type: string, format: date }
     *       - in: query
     *         name: to
     *         schema: { type: string, format: date }
     *         description: A date-only value covers the whole day (UTC).
     *     responses:
     *       200:
     *         description: 'CSV attachment. Content-Disposition: attachment; filename="reporte-estilos-colegio-<schoolId>[-grado-<gradeId>]-<from>-<to>.csv" (dates YYYY-MM-DD; open bounds use the first/last exported result date)'
     *         content:
     *           text/csv:
     *             schema: { type: string }
     *       400: { description: "schoolId is required, Invalid schoolId, Invalid gradeId, or an invalid period" }
     *       403: { description: "Teacher requesting another school — { error: 'You can only access data from your own school' }" }
     *       404: { description: "{ error: 'No results to export for the selected filters' }" }
     */
    router.get(
      "/export",
      roleGuard(ROLES.TEACHER, ROLES.ADMIN),
      controller.exportCsv,
    );

    /**
     * @openapi
     * /api/results/stats/user/{userId}:
     *   get:
     *     tags: [Results]
     *     summary: VAK summary stats for a user. Students can only access their own; Teacher/Admin can access any.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: userId
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: >
     *           { userId, total, predominantStyle, profile: "Estable" | "Variable" | null }.
     *           HU-38: profile is null with fewer than two results (no comparison yet).
     *       400: { description: Invalid userId }
     *       403: { description: Student accessing another user's stats }
     *       404: { description: User not found }
     */
    router.get(
      "/stats/user/:userId",
      roleGuard(ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN),
      controller.getUserStats,
    );

    /**
     * @openapi
     * /api/results/evolution/{studentId}:
     *   get:
     *     tags: [Results]
     *     summary: VAK probability evolution over time for a student. Student (own only), Teacher, Admin.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: studentId
     *         required: true
     *         schema: { type: integer }
     *       - in: query
     *         name: granularity
     *         schema: { type: string, enum: [day, month, year] }
     *         description: Time bucket size. Auto-inferred if omitted (≤90d→day, ≤730d→month, >730d→year).
     *       - in: query
     *         name: from
     *         schema: { type: string, format: date }
     *         description: Start date (YYYY-MM-DD). Defaults to date of student's first evaluation.
     *       - in: query
     *         name: to
     *         schema: { type: string, format: date }
     *         description: End date (YYYY-MM-DD). Defaults to today.
     *     responses:
     *       200: { description: Evolution data points }
     *       400: { description: Invalid params }
     *       403: { description: Student accessing another student's evolution }
     */
    router.get(
      "/evolution/:studentId",
      roleGuard(ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN),
      controller.getUserEvolution,
    );

    /**
     * @openapi
     * /api/results/student/{studentId}:
     *   get:
     *     tags: [Results]
     *     summary: Paginated results for a specific student. Teacher/Admin only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: studentId
     *         required: true
     *         schema: { type: integer }
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 10 }
     *       - in: query
     *         name: startDate
     *         schema: { type: string, format: date }
     *       - in: query
     *         name: endDate
     *         schema: { type: string, format: date }
     *         description: Inclusive; a date-only value covers the whole day (UTC)
     *       - in: query
     *         name: predominantStyle
     *         schema: { type: string, enum: [Visual, Auditory, Kinesthetic] }
     *       - in: query
     *         name: classifierType
     *         schema: { type: string }
     *         description: Filter by classifier type (e.g. xgboost)
     *     responses:
     *       200: { description: Paginated results for student }
     *       400: { description: Invalid params }
     */
    router.get(
      "/student/:studentId",
      roleGuard(ROLES.TEACHER, ROLES.ADMIN),
      controller.getByStudent,
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
