import type { VakValue } from "../../constants/vak.constant.js";

/** How MVI validation is applied during question generation. */
export type MviMode = "off" | "advisory" | "gate";

/** Persisted outcome of the validation; null = the question was never validated. */
export type MviStatus = "passed" | "failed" | "unavailable" | "skipped";

export interface ItemToValidate {
  id?: string;
  statement: string;
  /** Visual | Auditory | Kinesthetic */
  vakStyle: string;
  options: { text: string; vakValue: VakValue }[];
}

export type ItemViolationSeverity = "blocking" | "warning";

export interface ItemViolation {
  ruleId: string;
  message: string;
  measuredValue: unknown;
  threshold: unknown;
  severity: ItemViolationSeverity;
}

export interface ItemValidationResult {
  id?: string;
  approved: boolean;
  violations: ItemViolation[];
}

export interface ItemValidationBatch {
  results: ItemValidationResult[];
  catalogVersion: string;
}

export interface ItemValidatorCatalog {
  version: string;
  /** Maximum statement length in words for the configured level, if known. */
  maxWords: number | null;
  markers: Record<VakValue, string[]>;
}

/** Diagnosis stored with a question (`Question.mviResult`). */
export interface MviValidationRecord {
  approved: boolean;
  violations: ItemViolation[];
  attempts: number;
}
