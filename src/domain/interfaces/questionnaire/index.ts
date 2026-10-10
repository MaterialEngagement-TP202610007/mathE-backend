export interface CompleteQuestionnaireData {
  completionPercentage: number | null;
}

export interface AnswerInputData {
  questionId: number;
  selectedOptionId: number | null;
  navigationSequence: number;
  questionTimeSeconds: number;
  numberOfChanges: number;
  timesReviewed: number;
}

export interface CompleteWithAnswersAndDatasetParams {
  questionnaireId: number;
  studentId: number;
  completionPercentage: number;
  answers: AnswerInputData[];
}

export interface CompleteWithAnswersAndDatasetResult {
  visualScore: number;
  auditoryScore: number;
  kinestheticScore: number;
  responseConsistency: number;
  avgQuestionTime: number;
  totalChanges: number;
  totalReviews: number;
  vakLabel: string;
}

/** Question ids assigned to a questionnaire with their valid (non-deleted) option ids. */
export interface QuestionnaireQuestionOptions {
  questionId: number;
  optionIds: number[];
}

export interface PublicOptionView {
  id: number;
  text: string;
}

export interface PublicQuestionView {
  order: number;
  questionId: number;
  statement: string;
  contentType: string;
  mediaUrl: string | null;
  options: PublicOptionView[];
}

export interface CreateQuestionnaireResult {
  id: number;
  studentId: number;
  status: string;
  startTime: Date;
  usedFallback: boolean;
  createdAt: Date;
  updatedAt: Date;
  questions: PublicQuestionView[];
}

/**
 * An answer saved while the questionnaire is still in progress (HU-29).
 * Student-facing: never carries the option's VAK label.
 */
export interface SavedAnswerView {
  questionId: number;
  selectedOptionId: number | null;
  questionTimeSeconds: number;
  numberOfChanges: number;
  timesReviewed: number;
}

/** Answer upserted by the progressive save; same shape as the saved view. */
export type ProgressAnswerInput = SavedAnswerView;

/** Active questionnaire as stored: questions plus the answers saved so far. */
export interface ActiveQuestionnaireData extends CreateQuestionnaireResult {
  answers: SavedAnswerView[];
}

/** Active questionnaire returned to the student, with where to resume. */
export interface ActiveQuestionnaireResult extends ActiveQuestionnaireData {
  /** Questions with a saved, non-null option. */
  answeredCount: number;
  /**
   * 0-based index in `questions` to resume from: the first question without a
   * saved option, or the last question when every question has one.
   */
  resumeIndex: number;
}

export interface SaveProgressResult {
  questionnaireId: number;
  answers: SavedAnswerView[];
}

/**
 * A question already delivered to a student in a previous questionnaire.
 * The statement identifies fallback-bank questions, which are matched by text.
 */
export interface SeenQuestion {
  questionId: number;
  statement: string;
}

/** Fallback question template loaded from the local data bank. */
export interface FallbackQuestionTemplate {
  statement: string;
  contentType: string;
  vakStyle: string;
  
  options: Array<{ text: string; vakValue: string }>;
}

/** Params passed to the repo to atomically create questionnaire + questions. */
export interface QuestionnaireCreationParams {
  studentId: number;
  usedFallback: boolean;
  /** IDs of existing approved questions in the DB, with their assigned order. */
  assignedQuestions: Array<{ questionId: number; order: number }>;
  /** Fallback templates that need to be created (or reused) in the DB. */
  fallbackToCreate: Array<FallbackQuestionTemplate & { order: number }>;
}
