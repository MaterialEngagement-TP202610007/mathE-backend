import { CustomError } from "../../error/custom-error.js";
import { ROLES } from "../../constants/roles.constant.js";
import { UserEntity } from "../../entities/user.entity.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { NotificationRepository } from "../../repositories/notification.repository.js";
import { requiresActivation } from "../../policies/account-activation.policy.js";

/**
 * Admin approval of a pending teacher account. Students are active on
 * registration, so only teacher accounts can be activated.
 */
export class ActivateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(
    id: number,
    callerRoleId: number | null | undefined,
  ): Promise<UserEntity> {
    if (callerRoleId !== ROLES.ADMIN) {
      throw CustomError.forbidden("Only administrators can activate accounts");
    }

    const existing = await this.userRepository.findById(id);
    if (!existing) throw CustomError.notFound("User not found");
    if (existing.deletedAt) {
      throw CustomError.badRequest("Cannot activate a deleted user");
    }
    if (!requiresActivation(existing.roleId)) {
      throw CustomError.badRequest("Only teacher accounts require activation");
    }
    if (existing.isActive) {
      throw CustomError.badRequest("User is already active");
    }

    const user = await this.userRepository.setActive(id, true);

    await this.notificationRepository.create({
      studentId: id,
      type: "account_activated",
      message:
        "¡Tu cuenta ha sido activada! Ya puedes gestionar alumnos y generar preguntas VAK.",
    });

    return user;
  }
}
