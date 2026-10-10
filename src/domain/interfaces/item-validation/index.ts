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
  /** Content words allowed at the configured level; empty when unknown. */
  vocabulary: string[];
  /** Function words (articles, prepositions...) always allowed; empty when unknown. */
  functionWords: string[];
  /** Snapshot of the catalog rules (`/reglas`); empty when unknown. */
  rules: MviRuleSnapshot[];
}

/** One catalog rule as shown to teachers. */
export interface MviRuleSnapshot {
  id: string;
  description: string;
  /** Numeric threshold, or null when the rule has none or it is not numeric. */
  threshold: number | null;
  severity: ItemViolationSeverity;
}

export type MviAttemptKind = "generation" | "revision" | "revalidation";

/** One MVI `/validar` call recorded in the question's diagnosis trace. */
export interface MviAttemptRecord {
  /** 1-based position in the history. */
  attempt: number;
  kind: MviAttemptKind;
  statement: string;
  options: { text: string; vakValue: VakValue }[];
  approved: boolean;
  violations: ItemViolation[];
  /** ISO timestamp of the validation. */
  validatedAt: string;
}

/** Diagnosis stored with a question (`Question.mviResult`). */
export interface MviValidationRecord {
  approved: boolean;
  violations: ItemViolation[];
  attempts: number;
  /** Per-attempt trace; absent on questions created before it existed. */
  history?: MviAttemptRecord[];
  /** Catalog rules applied; absent on older questions or when the catalog was unavailable. */
  rules?: MviRuleSnapshot[];
}
