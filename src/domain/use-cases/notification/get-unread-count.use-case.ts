import { NotificationRepository } from "../../repositories/notification.repository.js";

export class GetUnreadCountUseCase {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(studentId: number): Promise<{ count: number }> {
    const count = await this.notificationRepository.countUnread(studentId);
    return { count };
  }
}
