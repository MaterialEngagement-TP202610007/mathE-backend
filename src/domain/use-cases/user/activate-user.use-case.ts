import { CustomError } from "../../error/custom-error.js";
import { ROLES } from "../../constants/roles.constant.js";
import { UserEntity } from "../../entities/user.entity.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { NotificationRepository } from "../../repositories/notification.repository.js";

export class ActivateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(id: number, callerRoleId?: number): Promise<UserEntity> {
    const existing = await this.userRepository.findById(id);
    if (!existing) throw CustomError.notFound("User not found");
    if (existing.deletedAt) {
      throw CustomError.badRequest("Cannot activate a deleted user");
    }
    if (existing.isActive) {
      throw CustomError.badRequest("User is already active");
    }

    if (callerRoleId === ROLES.TEACHER && existing.roleId !== ROLES.STUDENT) {
      throw CustomError.forbidden("Teachers can only activate students");
    }

    const user = await this.userRepository.setActive(id, true);

    const message =
      existing.roleId === ROLES.TEACHER
        ? "¡Tu cuenta ha sido activada! Ya puedes gestionar alumnos y generar preguntas VAK."
        : "¡Tu cuenta ha sido activada! Ya puedes iniciar el cuestionario de estilos de aprendizaje.";

    await this.notificationRepository.create({
      studentId: id,
      type: "account_activated",
      message,
    });

    return user;
  }
}
