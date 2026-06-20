import { QuestionEntity } from "../../entities/question.entity.js";
import { NotificationRepository } from "../../repositories/notification.repository.js";
import { GenerateQuestionDto } from "../../dtos/question/generate-question.dto.js";
import { GenerateQuestionUseCase } from "./generate-question.use-case.js";

export class BulkGenerateQuestionsUseCase {
  constructor(
    private readonly generateQuestionUseCase: GenerateQuestionUseCase,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(
    dto: GenerateQuestionDto,
    count: number,
    requesterId: number,
  ): Promise<QuestionEntity[]> {
    const questions = await Promise.all(
      Array.from({ length: count }, () => this.generateQuestionUseCase.execute(dto)),
    );

    await this.notificationRepository.create({
      studentId: requesterId,
      type: "questions_generated",
      message: `Se generaron ${count} pregunta(s) de estilo ${dto.vakStyle} exitosamente. Recuérdales aprobarlas o rechazarlas.`,
    });

    return questions;
  }
}
