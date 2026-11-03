import { SseRealtimeNotifierAdapterImpl } from '../../../../src/infrastructure/adapters/sse-realtime-notifier.adapter.impl.js';
import { SseNotificationService } from '../../../../src/infrastructure/services/sse-notification.service.js';

describe('SseRealtimeNotifierAdapterImpl (HU-35)', () => {
  it('pushes the payload as an SSE "notification" event to the user', () => {
    const sse = { push: jest.fn() } as unknown as jest.Mocked<SseNotificationService>;

    new SseRealtimeNotifierAdapterImpl(sse).notify(30, {
      type: 'result_available',
      resultId: 99,
      questionnaireId: 12,
    });

    expect(sse.push).toHaveBeenCalledWith(30, 'notification', {
      type: 'result_available',
      resultId: 99,
      questionnaireId: 12,
    });
  });

  it('writes the event on every open stream of that user only', () => {
    const service = new SseNotificationService();
    const write = jest.fn();
    const other = jest.fn();
    const pools = (service as unknown as { connections: Map<number, Set<{ write: jest.Mock }>> }).connections;
    pools.set(30, new Set([{ write }]));
    pools.set(31, new Set([{ write: other }]));

    new SseRealtimeNotifierAdapterImpl(service).notify(30, {
      type: 'result_available',
      resultId: 99,
      questionnaireId: 12,
    });

    expect(write).toHaveBeenCalledWith(
      'event: notification\ndata: {"type":"result_available","resultId":99,"questionnaireId":12}\n\n',
    );
    expect(other).not.toHaveBeenCalled();
  });
});
