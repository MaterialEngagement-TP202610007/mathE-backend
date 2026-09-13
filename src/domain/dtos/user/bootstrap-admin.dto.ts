import { regularExps } from "../../../config/helpers/regular-exp.js";

type EnvSource = Record<string, string | undefined>;

const REQUIRED_VARS = ["ADMIN_EMAIL", "ADMIN_PASSWORD", "ADMIN_NAME"] as const;

const PASSWORD_POLICY =
  "at least 8 characters, letters and digits only, with at least one letter and one digit";

/**
 * Admin bootstrap input, read from environment variables. Used by the seed and
 * by `pnpm db:bootstrap-admin` to provision the first admin account, since
 * public registration can never create admins.
 */
export class BootstrapAdminDto {
  private constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly name: string,
    public readonly resetPassword: boolean,
  ) {}

  /** True when every required ADMIN_* variable is present and non-blank. */
  static isConfigured(env: EnvSource): boolean {
    return REQUIRED_VARS.every((key) => Boolean(env[key]?.trim()));
  }

  static fromEnv(env: EnvSource): [string?, BootstrapAdminDto?] {
    const missing = REQUIRED_VARS.filter((key) => !env[key]?.trim());
    if (missing.length > 0) return [`Missing ${missing.join(", ")}`];

    const email = env.ADMIN_EMAIL!.trim();
    const name = env.ADMIN_NAME!.trim();
    const password = env.ADMIN_PASSWORD!;

    if (!regularExps.email.test(email)) return ["ADMIN_EMAIL is not a valid email"];
    if (!regularExps.password.test(password)) {
      return [`ADMIN_PASSWORD must be ${PASSWORD_POLICY}`];
    }

    const resetPassword = env.ADMIN_RESET_PASSWORD?.trim().toLowerCase() === "true";

    return [undefined, new BootstrapAdminDto(email, password, name, resetPassword)];
  }
}
