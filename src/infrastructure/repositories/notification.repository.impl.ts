import { prisma } from "../database/index.js";
import { NotificationRepository } from "../../domain/repositories/notification.repository.js";
import { NotificationEntity } from "../../domain/entities/notification.entity.js";
import {
  CreateNotificationData,
  NotificationListFilters,
} from "../../domain/interfaces/notification/index.js";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../domain/interfaces/shared/paginated-result.interface.js";

export class NotificationRepositoryImpl implements NotificationRepository {
  async create(data: CreateNotificationData): Promise<NotificationEntity> {
    const notification = await prisma.notification.create({
      data: {
        studentId: data.studentId,
        resultId: data.resultId ?? undefined,
        type: data.type,
        message: data.message,
      },
    });
    return NotificationEntity.fromObject(notification);
  }

  async findByStudent(
    studentId: number,
    pagination: PaginationDto,
    filters: NotificationListFilters = {},
  ): Promise<PaginatedResult<NotificationEntity>> {
    const where = {
      studentId,
      ...(filters.onlyUnread === true && { isRead: false }),
    };

    const { page, limit } = pagination;
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      items: rows.map(NotificationEntity.fromObject),
      total,
      page,
      limit,
    };
  }

  async findById(id: number): Promise<NotificationEntity | null> {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });
    return notification ? NotificationEntity.fromObject(notification) : null;
  }

  async markRead(id: number): Promise<NotificationEntity> {
    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return NotificationEntity.fromObject(notification);
  }

  async markAllRead(studentId: number): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { studentId, isRead: false },
      data: { isRead: true },
    });
    return result.count;
  }

  async countUnread(studentId: number): Promise<number> {
    return prisma.notification.count({
      where: { studentId, isRead: false },
    });
  }
}
