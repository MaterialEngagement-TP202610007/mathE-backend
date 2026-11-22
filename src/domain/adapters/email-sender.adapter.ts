export interface VerificationEmail {
  to: string;
  name: string;
  code: string;
  expiresInMinutes: number;
}

/** Sends transactional emails. Throws a CustomError when the provider fails. */
export interface EmailSenderAdapter {
  sendVerificationCode(email: VerificationEmail): Promise<void>;
}
