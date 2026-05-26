import { CustomError } from "../error/custom-error.js";

export class NotificationEntity {
  constructor(
    public id: number,
    public studentId: number,
    public resultId: number | null,
    public type: string,
    public message: string,
    public isRead: boolean,
    public createdAt: Date,
    public updatedAt: Date,
  ) {}

  static fromObject(object: { [key: string]: any }): NotificationEntity {
    const {
      id,
      studentId,
      resultId,
      type,
      message,
      isRead,
      createdAt,
      updatedAt,
    } = object;

    if (!id) throw CustomError.badRequest("Missing Notification Id");
    if (!studentId) throw CustomError.badRequest("Missing Student Id");
    if (!type) throw CustomError.badRequest("Missing Notification type");

    return new NotificationEntity(
      id,
      studentId,
      resultId ?? null,
      type,
      message ?? "",
      isRead ?? false,
      createdAt ? new Date(createdAt) : new Date(),
      updatedAt ? new Date(updatedAt) : new Date(),
    );
  }
}
