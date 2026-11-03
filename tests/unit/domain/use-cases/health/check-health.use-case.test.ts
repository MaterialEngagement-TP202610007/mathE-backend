import { CheckHealthUseCase } from '../../../../../src/domain/use-cases/health/check-health.use-case.js';
import { DatabaseHealthAdapter } from '../../../../../src/domain/adapters/database-health.adapter.js';
import { AiAvailabilityTracker } from '../../../../../src/domain/adapters/ai-availability-tracker.adapter.js';

function makeDbHealth(): jest.Mocked<DatabaseHealthAdapter> {
  return { ping: jest.fn() } as jest.Mocked<DatabaseHealthAdapter>;
}

describe('CheckHealthUseCase', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports ok when the database responds', async () => {
    const db = makeDbHealth();
    db.ping.mockResolvedValueOnce(undefined);

    await expect(new CheckHealthUseCase(db).execute()).resolves.toMatchObject({ status: 'ok', db: 'up' });
  });

  it('reports degraded when the database ping fails', async () => {
    const db = makeDbHealth();
    db.ping.mockRejectedValueOnce(new Error('connection refused'));

    await expect(new CheckHealthUseCase(db).execute()).resolves.toMatchObject({ status: 'degraded', db: 'down' });
  });

  describe('AI generation availability (HU-47)', () => {
    function makeTracker(state: ReturnType<AiAvailabilityTracker['current']>) {
      return {
        current: jest.fn().mockReturnValue(state),
        recordSuccess: jest.fn(),
        recordFailure: jest.fn(),
      } as jest.Mocked<AiAvailabilityTracker>;
    }

    it('reports the tracked state without calling the AI service', async () => {
      const db = makeDbHealth();
      db.ping.mockResolvedValueOnce(undefined);
      const since = new Date('2026-10-10T10:00:00.000Z');
      const tracker = makeTracker({ status: 'unavailable', since });

      const health = await new CheckHealthUseCase(db, tracker).execute();

      expect(health.aiGeneration).toEqual({ status: 'unavailable', since: '2026-10-10T10:00:00.000Z' });
      expect(tracker.recordSuccess).not.toHaveBeenCalled();
      expect(tracker.recordFailure).not.toHaveBeenCalled();
    });

    it('stays ok when only the AI service is down', async () => {
      const db = makeDbHealth();
      db.ping.mockResolvedValueOnce(undefined);

      const health = await new CheckHealthUseCase(
        db,
        makeTracker({ status: 'unavailable', since: new Date() }),
      ).execute();

      expect(health.status).toBe('ok');
    });

    it('reports unknown when nothing is tracked yet', async () => {
      const db = makeDbHealth();
      db.ping.mockResolvedValueOnce(undefined);

      await expect(new CheckHealthUseCase(db).execute()).resolves.toEqual({
        status: 'ok',
        db: 'up',
        aiGeneration: { status: 'unknown', since: null },
      });
    });
  });
});
