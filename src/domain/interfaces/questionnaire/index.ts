export interface CompleteQuestionnaireData {
  totalTimeSeconds: number | null;
  completionPercentage: number | null;
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
