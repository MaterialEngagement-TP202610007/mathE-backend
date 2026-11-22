/** Creates one-time verification codes and compares them without storing the plain code. */
export interface VerificationCodeAdapter {
  /** A random numeric code, e.g. "042917". */
  generate(): string;
  /** Deterministic hash stored instead of the code. */
  hash(code: string): string;
  /** Constant-time comparison of a submitted code against a stored hash. */
  matches(code: string, hash: string): boolean;
}
