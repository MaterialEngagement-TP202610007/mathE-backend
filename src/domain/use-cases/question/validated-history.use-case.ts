import { QuestionRepository } from "../../repositories/question.repository.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { ValidatedHistoryDto } from "../../dtos/question/validated-history.dto.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { QuestionEntity } from "../../entities/question.entity.js";

export class ValidatedHistoryUseCase {
  constructor(private readonly questionRepository: QuestionRepository) {}

  execute(
    teacherId: number,
    pagination: PaginationDto,
    filters?: ValidatedHistoryDto,
  ): Promise<PaginatedResult<QuestionEntity>> {
    return this.questionRepository.findValidatedHistory(teacherId, pagination, {
      vakStyle: filters?.vakStyle ?? undefined,
      fromDate: filters?.fromDate ?? undefined,
      toDate: filters?.toDate ?? undefined,
    });
  }
}
