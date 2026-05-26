import { CustomError } from "../../error/custom-error.js";
import { UserEntity } from "../../entities/user.entity.js";
import { UserRepository } from "../../repositories/user.repository.js";
import { NotificationRepository } from "../../repositories/notification.repository.js";

export class ActivateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(id: number): Promise<UserEntity> {
    const existing = await this.userRepository.findById(id);
    if (!existing) throw CustomError.notFound("User not found");
    if (existing.deletedAt) {
      throw CustomError.badRequest("Cannot activate a deleted user");
    }
    if (existing.isActive) {
      throw CustomError.badRequest("User is already active");
    }

    const user = await this.userRepository.setActive(id, true);

    await this.notificationRepository.create({
      studentId: id,
      type: "account_activated",
      message:
        "¡Tu cuenta ha sido activada! Ya puedes iniciar el cuestionario de estilos de aprendizaje.",
    });

    return user;
  }
}
