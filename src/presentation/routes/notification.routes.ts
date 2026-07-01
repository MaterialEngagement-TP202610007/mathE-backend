import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleGuard } from "../middlewares/role.middleware.js";
import { ROLES } from "../../domain/constants/roles.constant.js";
import { NotificationRepositoryImpl } from "../../infrastructure/repositories/notification.repository.impl.js";
import { GetNotificationsUseCase } from "../../domain/use-cases/notification/get-notifications.use-case.js";
import { MarkNotificationReadUseCase } from "../../domain/use-cases/notification/mark-notification-read.use-case.js";
import { MarkAllNotificationsReadUseCase } from "../../domain/use-cases/notification/mark-all-notifications-read.use-case.js";
import { GetUnreadCountUseCase } from "../../domain/use-cases/notification/get-unread-count.use-case.js";
import { sseNotificationService } from "../../infrastructure/services/sse-notification.service.js";

export class NotificationRoutes {
  static get routes(): Router {
    const router = Router();

    const notificationRepository = new NotificationRepositoryImpl();

    const controller = new NotificationController(
      new GetNotificationsUseCase(notificationRepository),
      new MarkNotificationReadUseCase(notificationRepository),
      new MarkAllNotificationsReadUseCase(notificationRepository),
      new GetUnreadCountUseCase(notificationRepository),
      sseNotificationService,
    );

    router.use(authMiddleware);

    /**
     * @openapi
     * /api/notifications/stream:
     *   get:
     *     tags: [Notifications]
     *     summary: SSE stream for real-time notifications. Any authenticated role.
     *     description: >
     *       Opens a persistent Server-Sent Events connection. The server pushes
     *       a `notification` event whenever a background job completes for this user.
     *       Connect with EventSource and withCredentials=true (cookie auth).
     *     security: [{ bearerAuth: [] }]
     *     responses:
     *       200:
     *         description: text/event-stream — persistent SSE connection
     */
    router.get("/stream", controller.stream);

    router.use(roleGuard(ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN));

    /**
     * @openapi
     * /api/notifications:
     *   get:
     *     tags: [Notifications]
     *     summary: List the authenticated student's notifications (paginated). Student only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 20 }
     *       - in: query
     *         name: unread
     *         schema: { type: boolean }
     *         description: If true, return only unread notifications.
     *     responses:
     *       200: { description: Paginated notifications }
     */
    router.get("/", controller.listMine);

    /**
     * @openapi
     * /api/notifications/unread-count:
     *   get:
     *     tags: [Notifications]
     *     summary: Get the number of unread notifications. Student only.
     *     security: [{ bearerAuth: [] }]
     *     responses:
     *       200:
     *         description: Unread count
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 count: { type: integer }
     */
    router.get("/unread-count", controller.unreadCount);

    /**
     * @openapi
     * /api/notifications/read-all:
     *   patch:
     *     tags: [Notifications]
     *     summary: Mark all notifications as read. Student only.
     *     security: [{ bearerAuth: [] }]
     *     responses:
     *       200:
     *         description: Number of notifications updated
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 updated: { type: integer }
     */
    router.patch("/read-all", controller.markAllRead);

    /**
     * @openapi
     * /api/notifications/{id}/read:
     *   patch:
     *     tags: [Notifications]
     *     summary: Mark a single notification as read. Student only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200: { description: Updated notification }
     *       403: { description: Not your notification }
     *       404: { description: Notification not found }
     */
    router.patch("/:id/read", controller.markRead);

    return router;
  }
}
