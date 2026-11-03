import {
  RealtimeNotification,
  RealtimeNotifier,
} from "../../domain/adapters/realtime-notifier.adapter.js";
import { SseNotificationService } from "../services/sse-notification.service.js";

/** Sends realtime notifications as SSE `notification` events (HU-35). */
export class SseRealtimeNotifierAdapterImpl extends RealtimeNotifier {
  constructor(private readonly sse: SseNotificationService) {
    super();
  }

  notify(userId: number, notification: RealtimeNotification): void {
    this.sse.push(userId, "notification", notification);
  }
}
