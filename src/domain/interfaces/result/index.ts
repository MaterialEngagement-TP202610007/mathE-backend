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
  /** HU-44: results whose label a teacher already corrected, or not yet. */
  labelStatus?: ResultLabelStatus;
}

export const RESULT_LABEL_STATUSES = ["corrected", "uncorrected"] as const;
export type ResultLabelStatus = (typeof RESULT_LABEL_STATUSES)[number];

export interface StudentResultFilters {
  predominantStyle?: string;
  classifierType?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface CorrectResultLabelData {
  resultId: number;
  teacherId: number;
  vakLabel: string;
  /** HU-44: when the correction happened. */
  correctedAt: Date;
}

/**
 * HU-51 report time range. Results are matched by `resultDate` (falling back to
 * `createdAt` for legacy rows without one). Missing bounds are open.
 */
export interface ReportPeriod {
  from?: Date;
  to?: Date;
}

export interface SchoolResultStats {
  schoolId: number;
  evaluatedStudents: number;
  mostCommonStyle: string | null;
  avgPredominantConfidence: number | null;
  /**
   * HU-50: questionnaires of the school's students whose `startTime` falls in
   * the period, whatever their status (in_progress, completed, abandoned).
   */
  startedQuestionnaires: number;
  /** HU-50: the started questionnaires that reached `completed`. */
  completedQuestionnaires: number;
  /** HU-50: completed ÷ started (0..1); null when nothing was started. */
  completionRate: number | null;
  /**
   * HU-50: mean seconds per question over the completed questionnaires, from
   * the ML dataset `avgQuestionTime` stored at completion; null when none.
   */
  avgResponseTimeSeconds: number | null;
}

/** Students per predominant VAK style. */
export interface VakStyleCounts {
  Visual: number;
  Auditory: number;
  Kinesthetic: number;
}

export interface GradeVakStats {
  gradeId: number;
  gradeName: string;
  level: string;
  evaluatedStudents: number;
  avgVisualProbability: number | null;
  avgAuditoryProbability: number | null;
  avgKinestheticProbability: number | null;
  /**
   * HU-48: each evaluated student counted once, by the predominant style of
   * their latest result in the period. Mixed profiles count under their
   * predominant style. Sums to `evaluatedStudents`.
   */
  styleCounts: VakStyleCounts;
}

/** HU-49: what a teacher exports (school required, grade and period optional). */
export interface ResultExportFilters extends ReportPeriod {
  schoolId: number;
  gradeId?: number;
}

/** HU-49: one exported result. Only report columns, never account or MVI data. */
export interface ResultExportRow {
  gradeName: string | null;
  gradeLevel: string | null;
  studentId: number;
  studentName: string;
  /** `resultDate`, or `createdAt` for legacy rows without one. */
  resultDate: Date;
  predominantStyle: string;
  predominantConfidence: number | null;
  visualProbability: number | null;
  auditoryProbability: number | null;
  kinestheticProbability: number | null;
  isMixedProfile: boolean;
  secondaryStyle: string | null;
  classifierType: string | null;
}

export interface ResultExport {
  schoolId: number;
  gradeId: number | null;
  /** Requested bounds, or the first/last exported result date when open. */
  from: Date;
  to: Date;
  rows: ResultExportRow[];
}

/** HU-38: one classified result read for the stability monitor. */
export interface StabilityResultRow {
  studentId: number;
  studentName: string;
  gradeId: number | null;
  gradeName: string | null;
  predominantStyle: "Visual" | "Auditory" | "Kinesthetic";
  /** `resultDate`, or `createdAt` for legacy rows without one. */
  resultDate: Date;
}

/** HU-38: filters of the stability monitor (same shape as the export). */
export type StabilityFilters = ResultExportFilters;

/** HU-38: classification variation of one student in the period. */
export interface StudentStability {
  studentId: number;
  studentName: string;
  gradeId: number | null;
  gradeName: string | null;
  resultsCount: number;
  firstStyle: "Visual" | "Auditory" | "Kinesthetic";
  lastStyle: "Visual" | "Auditory" | "Kinesthetic";
  /** Predominant-style changes between consecutive results. */
  changes: number;
  /** `null` when the student has a single result (no comparison yet). */
  profile: "stable" | "variable" | null;
  lastResultDate: Date;
}

export interface SchoolStabilityReport {
  schoolId: number;
  gradeId: number | null;
  summary: {
    students: number;
    stable: number;
    variable: number;
    insufficientData: number;
  };
  students: StudentStability[];
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
