import { QuestionEntity } from "../entities/question.entity.js";
import {
  CreateQuestionData,
  QuestionEmbeddingVector,
} from "../interfaces/question/index.js";
import { PaginationDto } from "../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../interfaces/shared/paginated-result.interface.js";

/** Slim question view used when assigning questions to a questionnaire (no sensitive VAK fields). */
export interface ApprovedQuestionSlim {
  id: number;
  statement: string;
  contentType: string;
  mediaUrl: string | null;
  options: Array<{ id: number; text: string }>;
}

export abstract class QuestionRepository {
  abstract findEmbeddingsByVakStyle(
    vakStyle: string,
  ): Promise<QuestionEmbeddingVector[]>;

  abstract createWithOptionsAndEmbedding(
    data: CreateQuestionData,
  ): Promise<QuestionEntity>;

  /**
   * Returns up to `limit` randomly-selected approved questions for a given
   * VAK style. Options are stripped of vakValue (not safe to expose).
   */
  abstract findApprovedByStyle(
    vakStyle: string,
    limit: number,
  ): Promise<ApprovedQuestionSlim[]>;

  abstract findByTeacher(
    teacherId: number,
    pagination: PaginationDto,
    validationStatus?: string,
  ): Promise<PaginatedResult<QuestionEntity>>;

  abstract findValidatedHistory(
    teacherId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<QuestionEntity>>;

  abstract findById(id: number): Promise<QuestionEntity | null>;

  abstract approve(id: number): Promise<QuestionEntity>;

  abstract reject(
    id: number,
    rejectionReason: string,
  ): Promise<QuestionEntity>;

  abstract softDelete(id: number): Promise<void>;
}
