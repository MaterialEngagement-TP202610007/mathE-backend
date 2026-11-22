export interface PendingVerificationCode {
  userId: number;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  /** When the code was (re)sent — used for the resend cooldown. */
  createdAt: Date;
}

export abstract class EmailVerificationRepository {
  abstract findByUserId(userId: number): Promise<PendingVerificationCode | null>;

  /** Replaces any previous code of the user and resets its attempts. */
  abstract save(code: Omit<PendingVerificationCode, "attempts">): Promise<void>;

  abstract incrementAttempts(userId: number): Promise<void>;

  /** Sets the user's emailVerifiedAt and removes the pending code, atomically. */
  abstract markVerified(userId: number, verifiedAt: Date): Promise<void>;
}
