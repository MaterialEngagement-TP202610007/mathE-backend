import { QuestionRepository } from "../../repositories/question.repository.js";
import { ListQuestionsDto } from "../../dtos/question/list-questions.dto.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { QuestionEntity } from "../../entities/question.entity.js";

export class ListQuestionsUseCase {
  constructor(private readonly questionRepository: QuestionRepository) {}

  execute(
    dto: ListQuestionsDto,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<QuestionEntity>> {
    return this.questionRepository.findByTeacher(
      dto.teacherId,
      pagination,
      dto.validationStatus ?? undefined,
    );
  }
}
