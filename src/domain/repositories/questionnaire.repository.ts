import { QuestionnaireEntity } from "../entities/questionnaire.entity.js";
import {
  ActiveQuestionnaireData,
  CompleteWithAnswersAndDatasetParams,
  CompleteWithAnswersAndDatasetResult,
  CreateQuestionnaireResult,
  QuestionnaireCreationParams,
  ProgressAnswerInput,
  QuestionnaireQuestionOptions,
  SavedAnswerView,
  SeenQuestion,
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

  /** In-progress questionnaire with its questions and saved answers. */
  abstract findActiveWithQuestions(
    studentId: number,
  ): Promise<ActiveQuestionnaireData | null>;

  /**
   * Upserts answers (one per question) of an in-progress questionnaire and
   * returns every saved answer. Throws a 409 CustomError when the
   * questionnaire is no longer in_progress (e.g. completed concurrently).
   */
  abstract saveProgress(
    questionnaireId: number,
    answers: ProgressAnswerInput[],
  ): Promise<SavedAnswerView[]>;

  /** Distinct questions assigned to any of the student's questionnaires. */
  abstract findSeenQuestions(studentId: number): Promise<SeenQuestion[]>;

  abstract findByStudent(
    studentId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<QuestionnaireEntity>>;

  /** Questions assigned to the questionnaire with their valid option ids. */
  abstract findQuestionOptions(
    questionnaireId: number,
  ): Promise<QuestionnaireQuestionOptions[]>;

  /**
   * Atomic transaction: replaces any progressively saved answers with the
   * 10 submitted ones, computes VAK features by joining
   * with Option table, creates the MLDataset row, and marks the questionnaire
   * as completed. Returns computed features and the simple-score vak label.
   * Throws a 409 CustomError when the questionnaire is no longer in_progress
   * (e.g. a concurrent request already completed it).
   */
  abstract completeWithAnswersAndDataset(
    params: CompleteWithAnswersAndDatasetParams,
  ): Promise<CompleteWithAnswersAndDatasetResult>;

  abstract abandon(id: number): Promise<QuestionnaireEntity>;
}
