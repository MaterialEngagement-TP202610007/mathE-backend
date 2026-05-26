export interface CreateNotificationData {
  studentId: number;
  resultId?: number | null;
  type: string;
  message: string;
}

export interface NotificationListFilters {
  onlyUnread?: boolean;
}
