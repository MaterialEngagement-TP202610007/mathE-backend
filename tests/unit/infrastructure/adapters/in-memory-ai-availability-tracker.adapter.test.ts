import { InMemoryAiAvailabilityTracker } from '../../../../src/infrastructure/adapters/in-memory-ai-availability-tracker.adapter.impl.js';

describe('InMemoryAiAvailabilityTracker (HU-47)', () => {
  const t0 = new Date('2026-10-10T10:00:00.000Z');
  const t1 = new Date('2026-10-10T10:05:00.000Z');
  const t2 = new Date('2026-10-10T10:09:00.000Z');

  function makeTracker(...times: Date[]) {
    const now = jest.fn<Date, []>();
    times.forEach((t) => now.mockReturnValueOnce(t));
    return new InMemoryAiAvailabilityTracker(now);
  }

  it('starts unknown until a generation reports an outcome', () => {
    expect(makeTracker().current()).toEqual({ status: 'unknown', since: null });
  });

  it('marks the service unavailable on the first failure and reports the outage start', () => {
    const tracker = makeTracker(t0);

    expect(tracker.recordFailure()).toBe(true);
    expect(tracker.current()).toEqual({ status: 'unavailable', since: t0 });
  });

  it('keeps the outage start on repeated failures', () => {
    const tracker = makeTracker(t0, t1);

    tracker.recordFailure();
    expect(tracker.recordFailure()).toBe(false);
    expect(tracker.current()).toEqual({ status: 'unavailable', since: t0 });
  });

  it('reports a restoration only when a success ends an outage', () => {
    const tracker = makeTracker(t0, t1, t2);

    tracker.recordFailure();
    expect(tracker.recordSuccess()).toBe(true);
    expect(tracker.current()).toEqual({ status: 'available', since: t1 });
    expect(tracker.recordSuccess()).toBe(false);
    expect(tracker.current()).toEqual({ status: 'available', since: t1 });
  });

  it('does not report a restoration for the first success after start-up', () => {
    const tracker = makeTracker(t0);

    expect(tracker.recordSuccess()).toBe(false);
    expect(tracker.current()).toEqual({ status: 'available', since: t0 });
  });
});
