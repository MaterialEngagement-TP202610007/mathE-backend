import { CustomError } from "../../error/custom-error.js";
import { QuestionFailureReason } from "../../interfaces/question/index.js";

/**
 * A question generation failure with its cause category (HU-47), so callers
 * can tell an AI outage apart from drafts that never passed the checks. It
 * keeps the status code and message the generation used to throw.
 */
export class QuestionGenerationError extends CustomError {
  constructor(
    statusCode: number,
    message: string,
    public readonly reason: QuestionFailureReason,
    public readonly originalError: unknown = null,
  ) {
    super(statusCode, message);
  }

  /** Every AI call failed (network, 5xx, quota, timeout, unusable answer). */
  static aiUnavailable(error: unknown): QuestionGenerationError {
    const statusCode = error instanceof CustomError ? error.statusCode : 502;
    const message =
      error instanceof Error ? error.message : "AI generation service unavailable";
    return new QuestionGenerationError(statusCode, message, "ai_unavailable", error);
  }

  /** The AI answered, but no draft passed the structural checks. */
  static validationFailed(message: string): QuestionGenerationError {
    return new QuestionGenerationError(503, message, "validation_failed");
  }

  /** The AI answered, but MVI (gate mode) blocked every attempt. */
  static mviRejected(message: string): QuestionGenerationError {
    return new QuestionGenerationError(503, message, "mvi_rejected");
  }
}

/** Failure reason for any error raised while generating one question. */
export function questionFailureReason(error: unknown): QuestionFailureReason {
  return error instanceof QuestionGenerationError ? error.reason : "internal_error";
}
