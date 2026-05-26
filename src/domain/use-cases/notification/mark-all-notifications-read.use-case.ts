import { NotificationRepository } from "../../repositories/notification.repository.js";

export class MarkAllNotificationsReadUseCase {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(studentId: number): Promise<{ updated: number }> {
    const count = await this.notificationRepository.markAllRead(studentId);
    return { updated: count };
  }
}
