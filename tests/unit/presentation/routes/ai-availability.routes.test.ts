// R3-002 (BE3 review): question generation and the health check must share
// one AI availability tracker, so an outage recorded while generating is the
// one GET /api/health reports.
jest.mock('../../../../src/config/database/index.js', () => ({ prisma: {} }));
jest.mock('../../../../src/config/envs.js', () => ({
  envs: { MVI_MODE: 'off', QUESTION_MAX_GENERATION_ATTEMPTS: 1, QUESTION_GENERATION_CONCURRENCY: 1 },
}));
// The generated client uses import.meta, which Jest cannot load.
jest.mock('../../../../src/generated/prisma/client.js', () => ({ Prisma: {} }));
jest.mock('../../../../src/infrastructure/adapters/jwt.adapter.impl.js', () => ({
  JwtAdapter: jest.fn().mockImplementation(() => ({ generate: jest.fn(), verify: jest.fn() })),
}));
jest.mock('../../../../src/infrastructure/adapters/gemini-question-generator.adapter.impl.js', () => ({
  GeminiQuestionGeneratorAdapter: jest.fn(),
}));
jest.mock('../../../../src/infrastructure/adapters/gemini-embedding.adapter.impl.js', () => ({
  GeminiEmbeddingAdapter: jest.fn(),
}));
jest.mock('../../../../src/infrastructure/adapters/gemini-image-generator.adapter.impl.js', () => ({
  GeminiImageGeneratorAdapter: jest.fn(),
}));
jest.mock('../../../../src/infrastructure/adapters/s3-image-storage.adapter.impl.js', () => ({
  S3ImageStorageAdapter: jest.fn(),
}));
jest.mock('../../../../src/infrastructure/adapters/mvi-item-validator.adapter.impl.js', () => ({
  MviItemValidatorAdapterImpl: jest.fn(),
}));
jest.mock('../../../../src/infrastructure/services/sse-notification.service.js', () => ({
  sseNotificationService: {},
}));
jest.mock('../../../../src/infrastructure/adapters/prisma-database-health.adapter.impl.js', () => ({
  PrismaDatabaseHealthAdapter: jest.fn().mockImplementation(() => ({ ping: jest.fn().mockResolvedValue(undefined) })),
}));
jest.mock('../../../../src/domain/use-cases/question/generate-question.use-case.js', () => ({
  GenerateQuestionUseCase: jest.fn(),
}));
const mockBulkConstructor = jest.fn();
jest.mock('../../../../src/domain/use-cases/question/bulk-generate-questions.use-case.js', () => ({
  BulkGenerateQuestionsUseCase: jest.fn().mockImplementation((...args: unknown[]) => {
    mockBulkConstructor(...args);
    return {};
  }),
}));

import { Request, Response } from 'express';
import { QuestionRoutes } from '../../../../src/presentation/routes/question.routes.js';
import { HealthRoutes } from '../../../../src/presentation/routes/health.routes.js';
import { AiAvailabilityTracker } from '../../../../src/domain/adapters/ai-availability-tracker.adapter.js';

type Handler = (req: Request, res: Response) => unknown;
interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handler }[] } }

describe('AI availability tracker wiring (HU-47, R3-002)', () => {
  it('reports through GET /api/health an outage recorded by question generation', async () => {
    void QuestionRoutes.routes;
    const tracker = mockBulkConstructor.mock.calls[0][6] as AiAvailabilityTracker;
    expect(tracker).toBeDefined();

    tracker.recordFailure();

    const stack = (HealthRoutes.routes as unknown as { stack: Layer[] }).stack;
    const layer = stack.find((l) => l.route?.path === '/' && l.route.methods.get);
    const handler = layer!.route!.stack[layer!.route!.stack.length - 1].handle;
    const res = {} as jest.Mocked<Response>;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);

    await handler({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ aiGeneration: expect.objectContaining({ status: 'unavailable' }) }),
    );
  });
});
