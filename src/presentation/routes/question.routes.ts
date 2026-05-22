import { Router } from "express";
import { QuestionController } from "../controllers/question.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleGuard } from "../middlewares/role.middleware.js";
import { ROLES } from "../../domain/constants/roles.constant.js";
import { GenerateQuestionUseCase } from "../../domain/use-cases/question/generate-question.use-case.js";
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
    );

    router.use(authMiddleware);

    /**
     * @openapi
     * /api/questions/generate:
     *   post:
     *     tags: [Questions]
     *     summary: Generate a VAK question via Gemini (statement + 4 options + embedding). Admin or Teacher.
     *     description: >
     *       Runs the generation pipeline: Gemini chat produces a statement and
     *       4 options, the statement is embedded and compared against existing
     *       same-style questions for redundancy, then Question + Options +
     *       Embedding are persisted atomically. The question starts as
     *       validationStatus=pending awaiting teacher validation.
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
     *               teacherId:
     *                 type: integer
     *                 nullable: true
     *                 description: Defaults to the authenticated user's id.
     *     responses:
     *       201:
     *         description: Question created (pending validation)
     *       400:
     *         description: Validation error
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

    return router;
  }
}
