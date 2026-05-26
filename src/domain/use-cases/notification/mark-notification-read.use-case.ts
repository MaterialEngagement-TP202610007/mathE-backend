import { NotificationRepository } from "../../repositories/notification.repository.js";
import { NotificationEntity } from "../../entities/notification.entity.js";
import { CustomError } from "../../error/custom-error.js";

export class MarkNotificationReadUseCase {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(id: number, studentId: number): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.findById(id);
    if (!notification) throw CustomError.notFound("Notification not found");
    if (notification.studentId !== studentId)
      throw CustomError.forbidden("Notification does not belong to you");

    return this.notificationRepository.markRead(id);
  }
}
