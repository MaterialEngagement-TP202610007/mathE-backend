import { compareSync, genSaltSync, hashSync } from "bcryptjs";
import { PasswordAdapter } from "../../domain/adapters/password.adapter.js";

export class BcryptAdapter implements PasswordAdapter {
  hash(password: string): string {
    return hashSync(password, genSaltSync());
  }

  compare(password: string, hashed: string): boolean {
    return compareSync(password, hashed);
  }
}
