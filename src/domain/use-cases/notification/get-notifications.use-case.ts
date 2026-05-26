import { NotificationRepository } from "../../repositories/notification.repository.js";
import { NotificationEntity } from "../../entities/notification.entity.js";
import { NotificationListFilters } from "../../interfaces/notification/index.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";

export class GetNotificationsUseCase {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(
    studentId: number,
    pagination: PaginationDto,
    filters?: NotificationListFilters,
  ): Promise<PaginatedResult<NotificationEntity>> {
    return this.notificationRepository.findByStudent(
      studentId,
      pagination,
      filters,
    );
  }
}
