import { VakStyle, VakValue } from "../../constants/vak.constant.js";
import { MviStatus, MviValidationRecord } from "../item-validation/index.js";

/** A single option as produced by the AI generator (PASO 1). */
export interface GeneratedOption {
  text: string;
  vakValue: VakValue;
}

/** Raw question produced by the AI chat model before persistence (PASO 1). */
export interface GeneratedQuestion {
  statement: string;
  options: GeneratedOption[];
}

/** Existing embedding fetched for the redundancy check (PASO 4). */
export interface QuestionEmbeddingVector {
  questionId: number;
  vector: number[];
}

/**
 * Everything needed to persist a question atomically (PASO 5):
 * Question (1) + Options (4) + QuestionEmbedding (1).
 */
export interface CreateQuestionData {
  statement: string;
  vakStyle: string;
  contentType: string;
  origin: string;
  validationStatus: string;
  generationDate: Date;
  teacherId: number | null;
  /** School whose question bank receives the question (the generating teacher's). */
  schoolId: number | null;
  options: GeneratedOption[];
  /** Null when embedding generation failed — the question is saved without one. */
  embeddingVector: number[] | null;
  embeddingModelVersion: string;
  mediaUrl?: string | null;
  mviStatus?: MviStatus | null;
  mviResult?: MviValidationRecord | null;
  mviCatalogVersion?: string | null;
  mviValidatedAt?: Date | null;
}

/** MVI diagnosis written back to an existing question (manual revalidation). */
export interface UpdateMviValidationData {
  mviStatus: MviStatus;
  mviResult: MviValidationRecord | null;
  mviCatalogVersion: string | null;
  mviValidatedAt: Date;
}

/** Teacher decision written when a pending question is approved (HU-42, HU-60). */
export interface ApproveQuestionData {
  /** True when the question is approved despite a failed MVI diagnosis. */
  approvedOverMvi?: boolean;
  /** VAK style stated by the teacher; null or absent keeps the current style. */
  vakStyle?: VakStyle | null;
}

/**
 * Why one question generation failed (HU-47), sent with the `question_failed`
 * SSE event: `ai_unavailable` when every AI call failed, `validation_failed`
 * when no draft passed the checks, `mvi_rejected` when MVI (gate mode) blocked
 * every attempt, `internal_error` for anything else (e.g. persistence).
 */
export type QuestionFailureReason =
  | "ai_unavailable"
  | "validation_failed"
  | "mvi_rejected"
  | "internal_error";
