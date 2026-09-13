jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

import { Request, Response } from 'express';
import { QuestionController } from '../../../../src/presentation/controllers/question.controller.js';
import { BulkGenerateQuestionsUseCase } from '../../../../src/domain/use-cases/question/bulk-generate-questions.use-case.js';
import { SseNotificationService } from '../../../../src/infrastructure/services/sse-notification.service.js';
import { QuestionEntity } from '../../../../src/domain/entities/question.entity.js';

function makeRes(): jest.Mocked<Response> {
  const res = {} as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(): Request {
  return {
    query: { count: '2' },
    body: { vakStyle: 'Visual' },
    user: { id: 7, email: 't@example.com', roleId: 2 },
  } as unknown as Request;
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('QuestionController.generate', () => {
  let bulk: { execute: jest.Mock };
  let sse: { push: jest.Mock };
  let controller: QuestionController;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    bulk = { execute: jest.fn() };
    sse = { push: jest.fn() };
    const unused = {} as never;
    controller = new QuestionController(
      bulk as unknown as BulkGenerateQuestionsUseCase,
      unused, unused, unused, unused, unused, unused,
      sse as unknown as SseNotificationService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('responds 202 immediately', async () => {
    bulk.execute.mockResolvedValueOnce([]);
    const res = makeRes();

    await controller.generate(makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ message: 'Generation started', vakStyle: 'Visual', count: 2 });
  });

  it('pushes a question_failed notification and logs when the batch fails before any progress', async () => {
    bulk.execute.mockRejectedValueOnce(new Error('database unavailable'));

    await controller.generate(makeReq(), makeRes(), jest.fn());
    await flushPromises();

    expect(sse.push).toHaveBeenCalledTimes(1);
    expect(sse.push).toHaveBeenCalledWith(7, 'notification', { type: 'question_failed', vakStyle: 'Visual' });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('generation'),
      'database unavailable',
    );
  });

  it('does not push a duplicate failure when per-question events were already sent', async () => {
    bulk.execute.mockImplementationOnce(async (_dto, _count, _userId, progress) => {
      progress.onFailed();
      progress.onFailed();
      throw new Error('Could not generate any Visual questions');
    });

    await controller.generate(makeReq(), makeRes(), jest.fn());
    await flushPromises();

    expect(sse.push).toHaveBeenCalledTimes(2);
    expect(sse.push).toHaveBeenNthCalledWith(1, 7, 'notification', { type: 'question_failed', vakStyle: 'Visual' });
  });

  it('attributes a teacher request to the authenticated teacher, ignoring body teacherId', async () => {
    bulk.execute.mockResolvedValueOnce([]);
    const req = { ...makeReq(), body: { vakStyle: 'Visual', teacherId: 99 } } as unknown as Request;

    await controller.generate(req, makeRes(), jest.fn());

    expect(bulk.execute.mock.calls[0][0].teacherId).toBe(7);
  });

  it('lets an admin attribute generation to a given teacherId', async () => {
    bulk.execute.mockResolvedValueOnce([]);
    const req = {
      ...makeReq(),
      body: { vakStyle: 'Visual', teacherId: 99 },
      user: { id: 1, email: 'a@example.com', roleId: 1 },
    } as unknown as Request;

    await controller.generate(req, makeRes(), jest.fn());

    expect(bulk.execute.mock.calls[0][0].teacherId).toBe(99);
  });

  it('defaults an admin request without teacherId to the admin id', async () => {
    bulk.execute.mockResolvedValueOnce([]);
    const req = { ...makeReq(), user: { id: 1, email: 'a@example.com', roleId: 1 } } as unknown as Request;

    await controller.generate(req, makeRes(), jest.fn());

    expect(bulk.execute.mock.calls[0][0].teacherId).toBe(1);
  });

  it('pushes question_generated events with the existing payload shape', async () => {
    const question = { id: 11, vakStyle: 'Visual' } as QuestionEntity;
    bulk.execute.mockImplementationOnce(async (_dto, _count, _userId, progress) => {
      progress.onGenerated(question);
      return [question];
    });

    await controller.generate(makeReq(), makeRes(), jest.fn());
    await flushPromises();

    expect(sse.push).toHaveBeenCalledWith(7, 'notification', {
      type: 'question_generated',
      questionId: 11,
      vakStyle: 'Visual',
    });
  });
});
