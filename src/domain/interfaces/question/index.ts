import { VakValue } from "../../constants/vak.constant.js";

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
}
