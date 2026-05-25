import { QuestionnaireRepository } from "../../repositories/questionnaire.repository.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { QuestionnaireEntity } from "../../entities/questionnaire.entity.js";

export class ListQuestionnairesUseCase {
  constructor(
    private readonly questionnaireRepository: QuestionnaireRepository,
  ) {}

  execute(
    studentId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<QuestionnaireEntity>> {
    return this.questionnaireRepository.findByStudent(studentId, pagination);
  }
}
