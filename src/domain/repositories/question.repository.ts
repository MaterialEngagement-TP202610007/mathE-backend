import { QuestionEntity } from "../entities/question.entity.js";
import {
  CreateQuestionData,
  UpdateMviValidationData,
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

export interface QuestionFilters {
  vakStyle?: string;
  fromDate?: Date;
  toDate?: Date;
}

export abstract class QuestionRepository {
  /** Most recent statements of a VAK style within one school's bank (dedupe hint). */
  abstract findRecentStatementsByVakStyle(
    vakStyle: string,
    limit: number,
    schoolId: number,
  ): Promise<string[]>;

  /**
   * Statements of a school's approved and pending questions, used as the
   * duplicate bank for MVI. `excludeId` leaves out the question being revalidated.
   */
  abstract findBankStatements(
    schoolId: number,
    excludeId?: number,
  ): Promise<string[]>;

  abstract createWithOptionsAndEmbedding(
    data: CreateQuestionData,
  ): Promise<QuestionEntity>;

  /**
   * Returns up to `limit` questions sampled uniformly at random among the
   * approved, AI-generated, non-deleted questions of a VAK style that belong
   * to `schoolId`. Options are stripped of vakValue (not safe to expose).
   */
  abstract findApprovedByStyle(
    vakStyle: string,
    limit: number,
    schoolId: number,
  ): Promise<ApprovedQuestionSlim[]>;

  abstract findByTeacher(
    teacherId: number,
    pagination: PaginationDto,
    validationStatus?: string,
    filters?: QuestionFilters,
  ): Promise<PaginatedResult<QuestionEntity>>;

  abstract findValidatedHistory(
    teacherId: number,
    pagination: PaginationDto,
    filters?: QuestionFilters,
  ): Promise<PaginatedResult<QuestionEntity>>;

  abstract findById(id: number): Promise<QuestionEntity | null>;

  /** `approvedOverMvi` flags an approval given despite a failed MVI diagnosis. */
  abstract approve(
    id: number,
    approvedOverMvi?: boolean,
  ): Promise<QuestionEntity>;

  abstract updateMviValidation(
    id: number,
    data: UpdateMviValidationData,
  ): Promise<QuestionEntity>;

  abstract reject(
    id: number,
    rejectionReason: string,
  ): Promise<QuestionEntity>;

  abstract softDelete(id: number): Promise<void>;
}
