import { QuestionnaireEntity } from "../entities/questionnaire.entity.js";
import {
  CompleteWithAnswersAndDatasetParams,
  CompleteWithAnswersAndDatasetResult,
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

  abstract findInProgressByStudent(
    studentId: number,
  ): Promise<QuestionnaireEntity | null>;

  abstract findActiveWithQuestions(
    studentId: number,
  ): Promise<CreateQuestionnaireResult | null>;

  abstract findByStudent(
    studentId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<QuestionnaireEntity>>;

  /**
   * Atomic transaction: saves 10 answers, computes VAK features by joining
   * with Option table, creates the MLDataset row, and marks the questionnaire
   * as completed. Returns computed features and the simple-score vak label.
   */
  abstract completeWithAnswersAndDataset(
    params: CompleteWithAnswersAndDatasetParams,
  ): Promise<CompleteWithAnswersAndDatasetResult>;

  abstract abandon(id: number): Promise<QuestionnaireEntity>;
}
