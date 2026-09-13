import { QuestionEntity } from "../../entities/question.entity.js";
import { QuestionRepository } from "../../repositories/question.repository.js";
import { NotificationRepository } from "../../repositories/notification.repository.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { GenerateQuestionDto } from "../../dtos/question/generate-question.dto.js";
import { GenerateQuestionUseCase } from "./generate-question.use-case.js";
import { CustomError } from "../../error/custom-error.js";

export interface BulkGenerateQuestionsConfig {
  /** Maximum number of generations running at the same time. */
  concurrency: number;
}

/** Resolved before generation starts (and before any AI call). */
export interface QuestionGenerationContext {
  /** School of the attributed teacher; generated questions join its bank. */
  schoolId: number;
}

export class BulkGenerateQuestionsUseCase {
  constructor(
    private readonly generateQuestionUseCase: GenerateQuestionUseCase,
    private readonly notificationRepository: NotificationRepository,
    private readonly questionRepository: QuestionRepository,
    private readonly userRepository: UserRepository,
    private readonly config: BulkGenerateQuestionsConfig = { concurrency: 2 },
  ) {}

  /**
   * Validates that generation can start: the attributed teacher must exist and
   * belong to a school. Cheap (no AI call) so callers can await it before
   * acknowledging a background generation request.
   */
  async prepare(dto: GenerateQuestionDto): Promise<QuestionGenerationContext> {
    const teacher =
      dto.teacherId !== null
        ? await this.userRepository.findById(dto.teacherId)
        : null;
    if (dto.teacherId !== null && !teacher) {
      throw CustomError.notFound("Teacher not found");
    }
    if (!teacher || teacher.schoolId === null) {
      throw CustomError.badRequest(
        "Teacher must belong to a school to generate questions",
      );
    }
    return { schoolId: teacher.schoolId };
  }

  async execute(
    dto: GenerateQuestionDto,
    count: number,
    requesterId: number,
    onProgress?: {
      onGenerated: (question: QuestionEntity) => void;
      onFailed: () => void;
    },
    context?: QuestionGenerationContext,
  ): Promise<QuestionEntity[]> {
    const { schoolId } = context ?? (await this.prepare(dto));

    // Dedupe hint is scoped to the school's own bank.
    const recentStatements = await this.questionRepository.findRecentStatementsByVakStyle(
      dto.vakStyle,
      20,
      schoolId,
    );

    const generateOne = () =>
      this.generateQuestionUseCase
        .execute(dto, recentStatements, schoolId)
        .then((q) => { onProgress?.onGenerated(q); return q; })
        .catch((err) => { onProgress?.onFailed(); throw err; });

    const results = await runWithConcurrency(
      count,
      Math.max(1, this.config.concurrency),
      generateOne,
    );

    const questions = results
      .filter((r): r is PromiseFulfilledResult<QuestionEntity> => r.status === "fulfilled")
      .map((r) => r.value);

    if (questions.length === 0) {
      throw CustomError.serviceUnavailable(
        `Could not generate any ${dto.vakStyle} questions`,
      );
    }

    await this.notificationRepository.create({
      studentId: requesterId,
      type: "questions_generated",
      message: `Se generaron ${questions.length} pregunta(s) de estilo ${dto.vakStyle} exitosamente. Recuérdales aprobarlas o rechazarlas.`,
    });

    return questions;
  }
}

/** Runs `task` `total` times with at most `limit` in flight; settles like Promise.allSettled. */
async function runWithConcurrency<T>(
  total: number,
  limit: number,
  task: () => Promise<T>,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(total);
  let next = 0;

  const worker = async () => {
    while (next < total) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await task() };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, total) }, worker));
  return results;
}
