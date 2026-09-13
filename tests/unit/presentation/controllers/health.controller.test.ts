import { Request, Response } from 'express';
import { HealthController } from '../../../../src/presentation/controllers/health.controller.js';
import { CheckHealthUseCase } from '../../../../src/domain/use-cases/health/check-health.use-case.js';

function makeRes(): jest.Mocked<Response> {
  const res = {} as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('HealthController.check', () => {
  it('responds 200 when healthy', async () => {
    const useCase = { execute: jest.fn().mockResolvedValue({ status: 'ok', db: 'up' }) };
    const res = makeRes();

    await new HealthController(useCase as unknown as CheckHealthUseCase).check({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'ok', db: 'up' });
  });

  it('responds 503 when degraded', async () => {
    const useCase = { execute: jest.fn().mockResolvedValue({ status: 'degraded', db: 'down' }) };
    const res = makeRes();

    await new HealthController(useCase as unknown as CheckHealthUseCase).check({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ status: 'degraded', db: 'down' });
  });
});
