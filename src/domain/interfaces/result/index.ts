export interface VakFeatures {
  visualScore: number;
  auditoryScore: number;
  kinestheticScore: number;
  responseConsistency: number;
  avgQuestionTime: number;
  totalChanges: number;
  totalReviews: number;
}

export interface LambdaClassifierInput {
  features: VakFeatures;
}

export interface LambdaClassifierOutput {
  predominantStyle: string;        // 'Visual' | 'Auditory' | 'Kinesthetic'
  secondaryStyle: string;          // second highest
  visualProbability: number;       // 0-100
  auditoryProbability: number;     // 0-100
  kinestheticProbability: number;  // 0-100
  predominantConfidence: number;   // 0-100
  profileType: string;             // 'clear' | 'tendency' | 'mixed'
  isMixedProfile: boolean;
  classifierType: string;          // 'xgboost'
}

export interface SaveResultData {
  questionnaireId: number;
  studentId: number;
  mlModelId: number | null;
  predominantStyle: string;
  secondaryStyle: string | null;
  visualProbability: number;
  auditoryProbability: number;
  kinestheticProbability: number;
  predominantConfidence: number;
  profileType: string | null;
  isMixedProfile: boolean;
  classifierType: string;
  modelVersion: string | null;
  aiFeedback: string;
  feedbackSource: string;
}

export interface CompleteQuestionnaireResult {
  resultId: number;
  predominantStyle: string;
  secondaryStyle: string | null;
  visualProbability: number;
  auditoryProbability: number;
  kinestheticProbability: number;
  predominantConfidence: number;
  profileType: string | null;
  isMixedProfile: boolean;
  classifierType: string;
  aiFeedback: string;
  feedbackSource: string;
}

export interface ResultListFilters {
  studentId?: number;
  gradeId?: number;
  schoolId?: number;
  classifierType?: string;
}

export interface CorrectResultLabelData {
  resultId: number;
  teacherId: number;
  vakLabel: string;
}
