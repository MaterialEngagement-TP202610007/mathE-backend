import { NotificationEntity } from "../entities/notification.entity.js";
import {
  CreateNotificationData,
  NotificationListFilters,
} from "../interfaces/notification/index.js";
import { PaginationDto } from "../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../interfaces/shared/paginated-result.interface.js";

export abstract class NotificationRepository {
  abstract create(data: CreateNotificationData): Promise<NotificationEntity>;

  abstract findByStudent(
    studentId: number,
    pagination: PaginationDto,
    filters?: NotificationListFilters,
  ): Promise<PaginatedResult<NotificationEntity>>;

  abstract findById(id: number): Promise<NotificationEntity | null>;

  abstract markRead(id: number): Promise<NotificationEntity>;

  abstract markAllRead(studentId: number): Promise<number>;

  abstract countUnread(studentId: number): Promise<number>;
}
