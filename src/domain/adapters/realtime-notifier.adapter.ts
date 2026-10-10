/** HU-35 S1: tells the student their result is ready to open. */
export interface ResultAvailableNotification {
  type: "result_available";
  resultId: number;
  questionnaireId: number;
}

export type RealtimeNotification = ResultAvailableNotification;

/**
 * Port for best-effort live notifications to a connected user. Delivery is
 * not guaranteed (the user may have no open stream); the persisted
 * notification stays the source of truth.
 */
export abstract class RealtimeNotifier {
  abstract notify(userId: number, notification: RealtimeNotification): void;
}
