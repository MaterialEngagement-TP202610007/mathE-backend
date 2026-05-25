import { AnswerRepository } from "../../repositories/answer.repository.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { AnswerEntity } from "../../entities/answer.entity.js";

export class ListAnswersUseCase {
  constructor(private readonly answerRepository: AnswerRepository) {}

  execute(
    questionnaireId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<AnswerEntity>> {
    return this.answerRepository.findByQuestionnaire(
      questionnaireId,
      pagination,
    );
  }
}
