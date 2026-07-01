import { QuestionEntity } from "../../entities/question.entity.js";
import { QuestionRepository } from "../../repositories/question.repository.js";
import { NotificationRepository } from "../../repositories/notification.repository.js";
import { GenerateQuestionDto } from "../../dtos/question/generate-question.dto.js";
import { GenerateQuestionUseCase } from "./generate-question.use-case.js";
import { CustomError } from "../../error/custom-error.js";

export class BulkGenerateQuestionsUseCase {
  constructor(
    private readonly generateQuestionUseCase: GenerateQuestionUseCase,
    private readonly notificationRepository: NotificationRepository,
    private readonly questionRepository: QuestionRepository,
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

    const results = await Promise.allSettled(
      Array.from({ length: count }, () =>
        this.generateQuestionUseCase
          .execute(dto, recentStatements)
          .then((q) => { onProgress?.onGenerated(q); return q; })
          .catch((err) => { onProgress?.onFailed(); throw err; }),
      ),
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
