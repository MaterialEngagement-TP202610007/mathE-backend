export interface VakFeatures {
  visualScore: number;
  auditoryScore: number;
  kinestheticScore: number;
  avgQuestionTime: number;
  totalChanges: number;
  totalClicks: number;
  engagementLevel: number;
  responseConsistency: number;
}

export interface LambdaClassifierInput {
  features: VakFeatures;
}

export interface LambdaClassifierOutput {
  predominantStyle: string;
  visualProbability: number;
  auditoryProbability: number;
  kinestheticProbability: number;
  modelVersion: string;
}

export interface SaveResultData {
  questionnaireId: number;
  studentId: number;
  mlModelId: number | null;
  predominantStyle: string;
  visualProbability: number;
  auditoryProbability: number;
  kinestheticProbability: number;
  isMixedProfile: boolean;
  classifierType: string;
  modelVersion: string | null;
  aiFeedback: string;
  feedbackSource: string;
  visualScore: number;
  auditoryScore: number;
  kinestheticScore: number;
  avgQuestionTime: number;
  totalTime: number | null;
  totalChanges: number;
  totalClicks: number;
  engagementLevel: number;
  responseConsistency: number;
  completionPercentage: number | null;
  vakLabel: string;
}

export interface CompleteQuestionnaireResult {
  resultId: number;
  predominantStyle: string;
  visualProbability: number;
  auditoryProbability: number;
  kinestheticProbability: number;
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
