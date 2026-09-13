import { ROLES } from "../../constants/roles.constant.js";
import { PasswordAdapter } from "../../adapters/password.adapter.js";
import { BootstrapAdminDto } from "../../dtos/user/bootstrap-admin.dto.js";
import { AdminBootstrapRepository } from "../../repositories/admin-bootstrap.repository.js";
import { BootstrapAdminResult } from "../../interfaces/user/index.js";

/** `User.birthDate` is required; admins have no meaningful one. */
const ADMIN_PLACEHOLDER_BIRTH_DATE = new Date("1970-01-01T00:00:00.000Z");

/**
 * Idempotently provisions an active admin account by email. An existing user
 * is promoted (role ADMIN, active, restored) and keeps its password unless
 * `resetPassword` is set.
 */
export class BootstrapAdminUseCase {
  constructor(
    private readonly repository: AdminBootstrapRepository,
    private readonly passwordAdapter: PasswordAdapter,
  ) {}

  async execute(dto: BootstrapAdminDto): Promise<BootstrapAdminResult> {
    const existing = await this.repository.findByEmail(dto.email);

    if (!existing) {
      const admin = await this.repository.createAdmin({
        email: dto.email,
        name: dto.name,
        passwordHash: this.passwordAdapter.hash(dto.password),
        roleId: ROLES.ADMIN,
        birthDate: ADMIN_PLACEHOLDER_BIRTH_DATE,
      });
      return { userId: admin.id, created: true, passwordUpdated: true };
    }

    const admin = await this.repository.promoteToAdmin(existing.id, {
      name: dto.name,
      roleId: ROLES.ADMIN,
      ...(dto.resetPassword && {
        passwordHash: this.passwordAdapter.hash(dto.password),
      }),
    });
    return {
      userId: admin.id,
      created: false,
      passwordUpdated: dto.resetPassword,
    };
  }
}
