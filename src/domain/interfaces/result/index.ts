export interface VakFeatures {
  visual_score: number;
  auditory_score: number;
  kinesthetic_score: number;
  response_consistency: number;
  avg_response_time: number;
  total_changes: number;
  total_backtracks: number;
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
  startDate?: Date;
  endDate?: Date;
}

export interface StudentResultFilters {
  predominantStyle?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface CorrectResultLabelData {
  resultId: number;
  teacherId: number;
  vakLabel: string;
}

export interface SchoolResultStats {
  schoolId: number;
  evaluatedStudents: number;
  mostCommonStyle: string | null;
  avgPredominantConfidence: number | null;
}

export interface GradeVakStats {
  gradeId: number;
  gradeName: string;
  level: string;
  evaluatedStudents: number;
  avgVisualProbability: number | null;
  avgAuditoryProbability: number | null;
  avgKinestheticProbability: number | null;
}

export interface UserResultStats {
  userId: number;
  total: number;
  predominantStyle: "Visual" | "Auditory" | "Kinesthetic" | null;
  profile: "Estable" | "Variable" | null;
}

export type Granularity = "day" | "month" | "year";

export interface EvolutionDataPoint {
  period: string;
  predominantStyle: "Visual" | "Auditory" | "Kinesthetic";
  avgVisualProbability: number;
  avgAuditoryProbability: number;
  avgKinestheticProbability: number;
  count: number;
}

export interface UserEvolutionResult {
  studentId: number;
  from: string;
  to: string;
  granularity: Granularity;
  totalEvaluations: number;
  dataPoints: EvolutionDataPoint[];
}
