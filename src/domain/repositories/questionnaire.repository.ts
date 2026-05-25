import { QuestionnaireEntity } from "../entities/questionnaire.entity.js";
import {
  CompleteQuestionnaireData,
  CreateQuestionnaireResult,
  QuestionnaireCreationParams,
} from "../interfaces/questionnaire/index.js";
import { PaginationDto } from "../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../interfaces/shared/paginated-result.interface.js";

export abstract class QuestionnaireRepository {
  /**
   * Atomically creates the questionnaire, persists any needed fallback
   * questions, and records the junction (QuestionnaireQuestion) rows.
   * Returns the questionnaire data plus the 10 public question views.
   */
  abstract createWithQuestions(
    params: QuestionnaireCreationParams,
  ): Promise<CreateQuestionnaireResult>;

  abstract findById(id: number): Promise<QuestionnaireEntity | null>;

  abstract findByStudent(
    studentId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<QuestionnaireEntity>>;

  abstract complete(
    id: number,
    data: CompleteQuestionnaireData,
  ): Promise<QuestionnaireEntity>;

  abstract abandon(id: number): Promise<QuestionnaireEntity>;
}
