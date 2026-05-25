import { Router } from "express";
import { QuestionController } from "../controllers/question.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleGuard } from "../middlewares/role.middleware.js";
import { ROLES } from "../../domain/constants/roles.constant.js";
import { GenerateQuestionUseCase } from "../../domain/use-cases/question/generate-question.use-case.js";
import { ListQuestionsUseCase } from "../../domain/use-cases/question/list-questions.use-case.js";
import { ValidatedHistoryUseCase } from "../../domain/use-cases/question/validated-history.use-case.js";
import { GetQuestionUseCase } from "../../domain/use-cases/question/get-question.use-case.js";
import { ApproveQuestionUseCase } from "../../domain/use-cases/question/approve-question.use-case.js";
import { RejectQuestionUseCase } from "../../domain/use-cases/question/reject-question.use-case.js";
import { DeleteQuestionUseCase } from "../../domain/use-cases/question/delete-question.use-case.js";
import { QuestionRepositoryImpl } from "../../infrastructure/repositories/question.repository.impl.js";
import { GeminiQuestionGeneratorAdapter } from "../../infrastructure/adapters/gemini-question-generator.adapter.impl.js";
import { GeminiEmbeddingAdapter } from "../../infrastructure/adapters/gemini-embedding.adapter.impl.js";
import { envs } from "../../config/envs.js";

export class QuestionRoutes {
  static get routes(): Router {
    const router = Router();

    const questionRepository = new QuestionRepositoryImpl();
    const aiGenerator = new GeminiQuestionGeneratorAdapter();
    const embeddingAdapter = new GeminiEmbeddingAdapter();

    const controller = new QuestionController(
      new GenerateQuestionUseCase(
        questionRepository,
        aiGenerator,
        embeddingAdapter,
        {
          similarityThreshold: envs.QUESTION_SIMILARITY_THRESHOLD,
          maxAttempts: envs.QUESTION_MAX_GENERATION_ATTEMPTS,
        },
      ),
      new ListQuestionsUseCase(questionRepository),
      new ValidatedHistoryUseCase(questionRepository),
      new GetQuestionUseCase(questionRepository),
      new ApproveQuestionUseCase(questionRepository),
      new RejectQuestionUseCase(questionRepository),
      new DeleteQuestionUseCase(questionRepository),
    );

    router.use(authMiddleware);

    /**
     * @openapi
     * /api/questions/generate:
     *   post:
     *     tags: [Questions]
     *     summary: Generate a VAK question via Gemini. Admin or Teacher.
     *     description: >
     *       Runs the full generation pipeline: Gemini produces a statement + 4 options,
     *       the statement is embedded and checked for redundancy against existing same-style
     *       questions, then Question + Options + Embedding are persisted atomically.
     *       The question starts with validationStatus=pending.
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [vakStyle]
     *             properties:
     *               vakStyle:
     *                 type: string
     *                 enum: [Visual, Auditory, Kinesthetic]
     *                 description: VAK learning style to target.
     *               teacherId:
     *                 type: integer
     *                 nullable: true
     *                 description: Defaults to the authenticated user's id.
     *     responses:
     *       201:
     *         description: Question created (validationStatus=pending)
     *       400:
     *         description: Validation error (missing or invalid vakStyle)
     *       502:
     *         description: Gemini returned an invalid or failed response
     *       503:
     *         description: Could not generate a unique question after max attempts
     */
    router.post(
      "/generate",
      roleGuard(ROLES.ADMIN, ROLES.TEACHER),
      controller.generate,
    );

    /**
     * @openapi
     * /api/questions/my:
     *   get:
     *     tags: [Questions]
     *     summary: List teacher's own questions (paginated). Admin or Teacher.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [pending, approved, rejected]
     *         description: Filter by validation status. Omit to return all.
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 10 }
     *     responses:
     *       200:
     *         description: Paginated list of questions
     *       400:
     *         description: Validation error (invalid status or pagination params)
     */
    router.get(
      "/my",
      roleGuard(ROLES.ADMIN, ROLES.TEACHER),
      controller.listMyQuestions,
    );

    /**
     * @openapi
     * /api/questions/my/validated-history:
     *   get:
     *     tags: [Questions]
     *     summary: Teacher's validated question history (approved + rejected). Admin or Teacher.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 10 }
     *     responses:
     *       200:
     *         description: Paginated list of approved and rejected questions
     *       400:
     *         description: Validation error (invalid pagination params)
     */
    router.get(
      "/my/validated-history",
      roleGuard(ROLES.ADMIN, ROLES.TEACHER),
      controller.validatedHistory,
    );

    /**
     * @openapi
     * /api/questions/{id}:
     *   get:
     *     tags: [Questions]
     *     summary: Get question detail with its options. Admin or Teacher.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *         description: Question id.
     *     responses:
     *       200:
     *         description: Question with options array
     *       400:
     *         description: Invalid id
     *       404:
     *         description: Question not found
     */
    router.get(
      "/:id",
      roleGuard(ROLES.ADMIN, ROLES.TEACHER),
      controller.getById,
    );

    /**
     * @openapi
     * /api/questions/{id}/approve:
     *   patch:
     *     tags: [Questions]
     *     summary: Approve a pending question. Admin or Teacher.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *         description: Question id.
     *     responses:
     *       200:
     *         description: Updated question with validationStatus=approved
     *       400:
     *         description: Invalid id or question is not pending
     *       404:
     *         description: Question not found
     */
    router.patch(
      "/:id/approve",
      roleGuard(ROLES.ADMIN, ROLES.TEACHER),
      controller.approve,
    );

    /**
     * @openapi
     * /api/questions/{id}/reject:
     *   patch:
     *     tags: [Questions]
     *     summary: Reject a pending question with a reason. Admin or Teacher.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *         description: Question id.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [rejectionReason]
     *             properties:
     *               rejectionReason:
     *                 type: string
     *                 description: Explanation of why the question was rejected.
     *     responses:
     *       200:
     *         description: Updated question with validationStatus=rejected
     *       400:
     *         description: Missing rejectionReason or question is not pending
     *       404:
     *         description: Question not found
     */
    router.patch(
      "/:id/reject",
      roleGuard(ROLES.ADMIN, ROLES.TEACHER),
      controller.reject,
    );

    /**
     * @openapi
     * /api/questions/{id}:
     *   delete:
     *     tags: [Questions]
     *     summary: Soft-delete a question (sets deletedAt). Admin or Teacher.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *         description: Question id.
     *     responses:
     *       204:
     *         description: Question deleted (no content)
     *       400:
     *         description: Invalid id
     *       404:
     *         description: Question not found
     */
    router.delete(
      "/:id",
      roleGuard(ROLES.ADMIN, ROLES.TEACHER),
      controller.softDelete,
    );

    return router;
  }
}
