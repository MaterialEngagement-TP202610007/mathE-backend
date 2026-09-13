import { QuestionEntity } from "../../entities/question.entity.js";
import { QuestionRepository } from "../../repositories/question.repository.js";
import { NotificationRepository } from "../../repositories/notification.repository.js";
import { GenerateQuestionDto } from "../../dtos/question/generate-question.dto.js";
import { GenerateQuestionUseCase } from "./generate-question.use-case.js";
import { CustomError } from "../../error/custom-error.js";

export interface BulkGenerateQuestionsConfig {
  /** Maximum number of generations running at the same time. */
  concurrency: number;
}

export class BulkGenerateQuestionsUseCase {
  constructor(
    private readonly generateQuestionUseCase: GenerateQuestionUseCase,
    private readonly notificationRepository: NotificationRepository,
    private readonly questionRepository: QuestionRepository,
    private readonly config: BulkGenerateQuestionsConfig = { concurrency: 2 },
  ) {}

  async execute(
    dto: GenerateQuestionDto,
    count: number,
    requesterId: number,
    onProgress?: {
      onGenerated: (question: QuestionEntity) => void;
      onFailed: () => void;
    },
  ): Promise<QuestionEntity[]> {
    const recentStatements = await this.questionRepository.findRecentStatementsByVakStyle(
      dto.vakStyle,
      20,
    );

    const generateOne = () =>
      this.generateQuestionUseCase
        .execute(dto, recentStatements)
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
