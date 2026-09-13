import { CheckHealthUseCase } from '../../../../../src/domain/use-cases/health/check-health.use-case.js';
import { DatabaseHealthAdapter } from '../../../../../src/domain/adapters/database-health.adapter.js';

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

    await expect(new CheckHealthUseCase(db).execute()).resolves.toEqual({ status: 'ok', db: 'up' });
  });

  it('reports degraded when the database ping fails', async () => {
    const db = makeDbHealth();
    db.ping.mockRejectedValueOnce(new Error('connection refused'));

    await expect(new CheckHealthUseCase(db).execute()).resolves.toEqual({ status: 'degraded', db: 'down' });
  });
});
