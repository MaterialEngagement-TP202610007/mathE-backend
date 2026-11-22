export interface EmailVerificationConfig {
  /** Minutes a code stays valid. */
  codeTtlMinutes: number;
  /** Wrong codes allowed before a new code must be requested. */
  maxAttempts: number;
  /** Minimum seconds between two codes sent to the same user. */
  resendCooldownSeconds: number;
  /** Injectable clock — lets tests pin the time. */
  now?: () => Date;
}

/** Generic message: never reveals whether the email exists or which check failed. */
export const INVALID_CODE_MESSAGE = "Invalid or expired verification code";

export const EMAIL_NOT_VERIFIED_MESSAGE =
  "Email not verified. Enter the code sent to your email";
