import { Router } from "express";
import { QuestionnaireController } from "../controllers/questionnaire.controller.js";
import { AnswerController } from "../controllers/answer.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleGuard } from "../middlewares/role.middleware.js";
import { ROLES } from "../../domain/constants/roles.constant.js";
import { CreateQuestionnaireUseCase } from "../../domain/use-cases/questionnaire/create-questionnaire.use-case.js";
import { GetQuestionnaireUseCase } from "../../domain/use-cases/questionnaire/get-questionnaire.use-case.js";
import { ListQuestionnairesUseCase } from "../../domain/use-cases/questionnaire/list-questionnaires.use-case.js";
import { CompleteQuestionnaireUseCase } from "../../domain/use-cases/questionnaire/complete-questionnaire.use-case.js";
import { AbandonQuestionnaireUseCase } from "../../domain/use-cases/questionnaire/abandon-questionnaire.use-case.js";
import { GetActiveQuestionnaireUseCase } from "../../domain/use-cases/questionnaire/get-active-questionnaire.use-case.js";
import { CreateAnswerUseCase } from "../../domain/use-cases/answer/create-answer.use-case.js";
import { ListAnswersUseCase } from "../../domain/use-cases/answer/list-answers.use-case.js";
import { GetAnswerUseCase } from "../../domain/use-cases/answer/get-answer.use-case.js";
import { QuestionnaireRepositoryImpl } from "../../infrastructure/repositories/questionnaire.repository.impl.js";
import { AnswerRepositoryImpl } from "../../infrastructure/repositories/answer.repository.impl.js";
import { QuestionRepositoryImpl } from "../../infrastructure/repositories/question.repository.impl.js";
import { ResultRepositoryImpl } from "../../infrastructure/repositories/result.repository.impl.js";
import { MLModelRepositoryImpl } from "../../infrastructure/repositories/ml-model.repository.impl.js";
import { FallbackQuestionsAdapterImpl } from "../../infrastructure/adapters/fallback-questions.adapter.impl.js";
import { LambdaClassifierAdapterImpl } from "../../infrastructure/adapters/lambda-classifier.adapter.impl.js";
import { GeminiVakFeedbackAdapterImpl } from "../../infrastructure/adapters/gemini-vak-feedback.adapter.impl.js";

export class QuestionnaireRoutes {
  static get routes(): Router {
    const router = Router();

    const questionnaireRepository = new QuestionnaireRepositoryImpl();
    const questionRepository = new QuestionRepositoryImpl();
    const answerRepository = new AnswerRepositoryImpl();
    const resultRepository = new ResultRepositoryImpl();
    const mlModelRepository = new MLModelRepositoryImpl();
    const fallbackAdapter = new FallbackQuestionsAdapterImpl();
    const lambdaAdapter = new LambdaClassifierAdapterImpl();
    const feedbackAdapter = new GeminiVakFeedbackAdapterImpl();

    const questionnaireController = new QuestionnaireController(
      new CreateQuestionnaireUseCase(
        questionnaireRepository,
        questionRepository,
        fallbackAdapter,
      ),
      new GetQuestionnaireUseCase(questionnaireRepository),
      new ListQuestionnairesUseCase(questionnaireRepository),
      new CompleteQuestionnaireUseCase(
        questionnaireRepository,
        mlModelRepository,
        resultRepository,
        lambdaAdapter,
        feedbackAdapter,
      ),
      new AbandonQuestionnaireUseCase(questionnaireRepository),
      new GetActiveQuestionnaireUseCase(questionnaireRepository),
    );

    const answerController = new AnswerController(
      new CreateAnswerUseCase(answerRepository, questionnaireRepository),
      new ListAnswersUseCase(answerRepository),
      new GetAnswerUseCase(answerRepository),
    );

    router.use(authMiddleware);

    /**
     * @openapi
     * /api/questionnaires:
     *   post:
     *     tags: [Questionnaires]
     *     summary: Start a new questionnaire session. Student only.
     *     description: >
     *       Creates a questionnaire (status=in_progress) and selects 10 questions
     *       distributed across VAK styles (Visual=4, Auditory=3, Kinesthetic=3).
     *       Questions are selected randomly from approved DB questions; if there
     *       are not enough for a style, the local fallback bank is used (usedFallback=true).
     *       The response includes the 10 questions in randomised order. The question's
     *       own vakStyle is hidden, but each option exposes its vakValue (V|A|K) label.
     *     security: [{ bearerAuth: [] }]
     *     responses:
     *       201:
     *         description: Questionnaire created with 10 questions
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 id: { type: integer }
     *                 studentId: { type: integer }
     *                 status: { type: string, example: in_progress }
     *                 startTime: { type: string, format: date-time }
     *                 usedFallback: { type: boolean }
     *                 createdAt: { type: string, format: date-time }
     *                 updatedAt: { type: string, format: date-time }
     *                 questions:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       order: { type: integer }
     *                       questionId: { type: integer }
     *                       statement: { type: string }
     *                       contentType: { type: string }
     *                       mediaUrl: { type: string, nullable: true }
     *                       options:
     *                         type: array
     *                         items:
     *                           type: object
     *                           properties:
     *                             id: { type: integer }
     *                             text: { type: string }
     *                             vakValue: { type: string, enum: [V, A, K] }
     *       401: { description: Not authenticated }
     *       403: { description: Student role required }
     */
    router.post("/", roleGuard(ROLES.STUDENT), questionnaireController.create);

    /**
     * @openapi
     * /api/questionnaires:
     *   get:
     *     tags: [Questionnaires]
     *     summary: List the authenticated student's questionnaires (paginated). Student only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 10 }
     *     responses:
     *       200: { description: Paginated list of the student's questionnaires }
     *       400: { description: Invalid pagination params }
     */
    router.get("/", roleGuard(ROLES.STUDENT), questionnaireController.listMine);

    /**
     * @openapi
     * /api/questionnaires/active:
     *   get:
     *     tags: [Questionnaires]
     *     summary: Get the student's current in-progress questionnaire with all questions. Student only.
     *     description: >
     *       Returns the active (status=in_progress) questionnaire for the authenticated student,
     *       including all 10 questions and options. Intended for recovery after an abrupt browser
     *       close when local storage has been lost.
     *     security: [{ bearerAuth: [] }]
     *     responses:
     *       200:
     *         description: Active questionnaire with questions
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 id: { type: integer }
     *                 studentId: { type: integer }
     *                 status: { type: string, example: in_progress }
     *                 startTime: { type: string, format: date-time }
     *                 usedFallback: { type: boolean }
     *                 createdAt: { type: string, format: date-time }
     *                 updatedAt: { type: string, format: date-time }
     *                 questions:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       order: { type: integer }
     *                       questionId: { type: integer }
     *                       statement: { type: string }
     *                       contentType: { type: string }
     *                       mediaUrl: { type: string, nullable: true }
     *                       options:
     *                         type: array
     *                         items:
     *                           type: object
     *                           properties:
     *                             id: { type: integer }
     *                             text: { type: string }
     *                             vakValue: { type: string, enum: [V, A, K] }
     *       401: { description: Not authenticated }
     *       403: { description: Student role required }
     *       404: { description: No active questionnaire found }
     */
    router.get(
      "/active",
      roleGuard(ROLES.STUDENT),
      questionnaireController.getActive,
    );

    /**
     * @openapi
     * /api/questionnaires/{id}:
     *   get:
     *     tags: [Questionnaires]
     *     summary: Get questionnaire detail. Student, Teacher or Admin.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200: { description: Questionnaire detail }
     *       400: { description: Invalid id }
     *       404: { description: Questionnaire not found }
     */
    router.get(
      "/:id",
      roleGuard(ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN),
      questionnaireController.getById,
    );

    /**
     * @openapi
     * /api/questionnaires/{id}/complete:
     *   patch:
     *     tags: [Questionnaires]
     *     summary: Mark an in-progress questionnaire as completed. Student only.
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
     *             required: [completionPercentage, answers]
     *             properties:
     *               completionPercentage:
     *                 type: number
     *                 minimum: 0
     *                 maximum: 100
     *               answers:
     *                 type: array
     *                 minItems: 10
     *                 maxItems: 10
     *                 items:
     *                   type: object
     *                   required: [questionId, selectedOptionId, questionTimeSeconds, numberOfChanges, timesReviewed]
     *                   properties:
     *                     questionId: { type: integer }
     *                     selectedOptionId: { type: integer, nullable: true }
     *                     questionTimeSeconds: { type: number }
     *                     numberOfChanges: { type: integer }
     *                     timesReviewed: { type: integer }
     *     responses:
     *       200: { description: Questionnaire completed }
     *       400: { description: Invalid id, body, or questionnaire not in_progress }
     *       404: { description: Questionnaire not found }
     */
    router.patch(
      "/:id/complete",
      roleGuard(ROLES.STUDENT),
      questionnaireController.complete,
    );

    /**
     * @openapi
     * /api/questionnaires/{id}/abandon:
     *   patch:
     *     tags: [Questionnaires]
     *     summary: Abandon an in-progress questionnaire. Student only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200: { description: Questionnaire abandoned }
     *       400: { description: Invalid id or questionnaire not in_progress }
     *       404: { description: Questionnaire not found }
     */
    router.patch(
      "/:id/abandon",
      roleGuard(ROLES.STUDENT),
      questionnaireController.abandon,
    );

    /**
     * @openapi
     * /api/questionnaires/{id}/answers:
     *   post:
     *     tags: [Answers]
     *     summary: Submit an answer for a question in this questionnaire. Student only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *         description: Questionnaire id.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [questionId]
     *             properties:
     *               questionId:
     *                 type: integer
     *               selectedOptionId:
     *                 type: integer
     *                 nullable: true
     *                 description: Null if question was skipped/abandoned.
     *               navigationSequence:
     *                 type: integer
     *                 nullable: true
     *               questionTimeSeconds:
     *                 type: number
     *                 nullable: true
     *               numberOfChanges:
     *                 type: integer
     *                 nullable: true
     *               numberOfClicks:
     *                 type: integer
     *                 nullable: true
     *               timesReviewed:
     *                 type: integer
     *                 nullable: true
     *     responses:
     *       201: { description: Answer recorded }
     *       400: { description: Validation error or questionnaire not in_progress }
     *       404: { description: Questionnaire not found }
     */
    router.post(
      "/:id/answers",
      roleGuard(ROLES.STUDENT),
      answerController.create,
    );

    /**
     * @openapi
     * /api/questionnaires/{id}/answers:
     *   get:
     *     tags: [Answers]
     *     summary: List all answers for a questionnaire (paginated).
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 10 }
     *     responses:
     *       200: { description: Paginated answers ordered by navigationSequence }
     *       400: { description: Invalid id or pagination params }
     */
    router.get(
      "/:id/answers",
      roleGuard(ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN),
      answerController.listByQuestionnaire,
    );

    /**
     * @openapi
     * /api/questionnaires/{id}/answers/{answerId}:
     *   get:
     *     tags: [Answers]
     *     summary: Get a specific answer detail.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *         description: Questionnaire id.
     *       - in: path
     *         name: answerId
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200: { description: Answer detail }
     *       400: { description: Invalid ids }
     *       404: { description: Answer not found in this questionnaire }
     */
    router.get(
      "/:id/answers/:answerId",
      roleGuard(ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN),
      answerController.getById,
    );

    return router;
  }
}
