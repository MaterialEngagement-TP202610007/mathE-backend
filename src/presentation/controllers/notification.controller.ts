import { NextFunction, Request, Response } from "express";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { GetNotificationsUseCase } from "../../domain/use-cases/notification/get-notifications.use-case.js";
import { MarkNotificationReadUseCase } from "../../domain/use-cases/notification/mark-notification-read.use-case.js";
import { MarkAllNotificationsReadUseCase } from "../../domain/use-cases/notification/mark-all-notifications-read.use-case.js";
import { GetUnreadCountUseCase } from "../../domain/use-cases/notification/get-unread-count.use-case.js";

export class NotificationController {
  constructor(
    private readonly getNotificationsUseCase: GetNotificationsUseCase,
    private readonly markNotificationReadUseCase: MarkNotificationReadUseCase,
    private readonly markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase,
    private readonly getUnreadCountUseCase: GetUnreadCountUseCase,
  ) {}

  private parsePagination(req: Request): [string?, PaginationDto?] {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    return PaginationDto.create(page, limit);
  }

  listMine = async (req: Request, res: Response, next: NextFunction) => {
    const [error, pagination] = this.parsePagination(req);
    if (error) return res.status(400).json({ error });

    const onlyUnread = req.query.unread === "true";

    try {
      const result = await this.getNotificationsUseCase.execute(
        req.user!.id,
        pagination!,
        { onlyUnread },
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  unreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.getUnreadCountUseCase.execute(req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ error: "Invalid notification id" });

    try {
      const notification = await this.markNotificationReadUseCase.execute(
        id,
        req.user!.id,
      );
      res.json(notification);
    } catch (err) {
      next(err);
    }
  };

  markAllRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.markAllNotificationsReadUseCase.execute(
        req.user!.id,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
