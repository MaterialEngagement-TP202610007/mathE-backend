import { EventEmitter } from 'node:events';
import { Response } from 'express';
import { SseNotificationService } from '../../../../src/infrastructure/services/sse-notification.service.js';

function makeRes() {
  const emitter = new EventEmitter();
  const res = Object.assign(emitter, {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(() => emitter.emit('close')),
    socket: { setNoDelay: jest.fn() },
  });
  return res as unknown as Response & { write: jest.Mock; end: jest.Mock };
}

describe('SseNotificationService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('pushes a named event to every connection of the user', () => {
    const service = new SseNotificationService();
    const res = makeRes();
    service.register(7, res);

    service.push(7, 'notification', { type: 'question_failed', vakStyle: 'Visual' });

    expect(res.write).toHaveBeenCalledWith(
      'event: notification\ndata: {"type":"question_failed","vakStyle":"Visual"}\n\n',
    );
  });

  it('closeAll ends every open stream and forgets the connections', () => {
    const service = new SseNotificationService();
    const a = makeRes();
    const b = makeRes();
    service.register(1, a);
    service.register(2, b);

    service.closeAll();
    service.push(1, 'notification', {});

    expect(a.end).toHaveBeenCalled();
    expect(b.end).toHaveBeenCalled();
    expect(a.write).not.toHaveBeenCalled();
  });
});
