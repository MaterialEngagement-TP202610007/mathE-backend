import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { VerificationCodeAdapter } from "../../domain/adapters/verification-code.adapter.js";

const CODE_DIGITS = 6;

/**
 * 6-digit codes from a CSPRNG. Codes are stored as an HMAC-SHA256 keyed with a
 * server secret, so a leaked table cannot be reversed without that secret.
 */
export class CryptoVerificationCodeAdapterImpl implements VerificationCodeAdapter {
  constructor(private readonly secret: string) {}

  generate(): string {
    return randomInt(0, 10 ** CODE_DIGITS).toString().padStart(CODE_DIGITS, "0");
  }

  hash(code: string): string {
    return createHmac("sha256", this.secret).update(code).digest("hex");
  }

  matches(code: string, hash: string): boolean {
    const expected = Buffer.from(this.hash(code), "hex");
    const stored = Buffer.from(hash, "hex");
    return stored.length === expected.length && timingSafeEqual(stored, expected);
  }
}
