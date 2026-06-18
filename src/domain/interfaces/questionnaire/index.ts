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

export interface PublicOptionView {
  id: number;
  text: string;
  vakValue: string; // V | A | K — the option's VAK label
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
