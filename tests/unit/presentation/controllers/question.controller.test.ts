jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

import { Request, Response } from 'express';
import { QuestionController } from '../../../../src/presentation/controllers/question.controller.js';
import { BulkGenerateQuestionsUseCase } from '../../../../src/domain/use-cases/question/bulk-generate-questions.use-case.js';
import { SseNotificationService } from '../../../../src/infrastructure/services/sse-notification.service.js';
import { QuestionEntity } from '../../../../src/domain/entities/question.entity.js';
import { CustomError } from '../../../../src/domain/error/custom-error.js';

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
  let bulk: { execute: jest.Mock; prepare: jest.Mock };
  let sse: { push: jest.Mock };
  let controller: QuestionController;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    bulk = { execute: jest.fn(), prepare: jest.fn().mockResolvedValue({ schoolId: 4 }) };
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

  it('validates the teacher school before responding and passes the context to the background run', async () => {
    bulk.execute.mockResolvedValueOnce([]);
    const res = makeRes();

    await controller.generate(makeReq(), res, jest.fn());

    expect(bulk.prepare).toHaveBeenCalledWith(expect.objectContaining({ teacherId: 7, vakStyle: 'Visual' }));
    expect(bulk.execute.mock.calls[0][4]).toEqual({ schoolId: 4 });
  });

  it('forwards the 400 for a teacher without school instead of responding 202', async () => {
    const error = CustomError.badRequest('Teacher must belong to a school to generate questions');
    bulk.prepare.mockRejectedValueOnce(error);
    const res = makeRes();
    const next = jest.fn();

    await controller.generate(makeReq(), res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalledWith(202);
    expect(bulk.execute).not.toHaveBeenCalled();
    expect(sse.push).not.toHaveBeenCalled();
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

describe('QuestionController school-scoped question actions', () => {
  const question = { id: 5 } as QuestionEntity;
  const teacherReq = (extra: Partial<Request> = {}) => ({
    params: { id: '5' },
    query: {},
    body: { rejectionReason: 'Unclear' },
    user: { id: 7, email: 't@example.com', roleId: 2 },
    ...extra,
  }) as unknown as Request;

  function makeController() {
    const useCases = {
      get: { execute: jest.fn().mockResolvedValue(question) },
      approve: { execute: jest.fn().mockResolvedValue(question) },
      reject: { execute: jest.fn().mockResolvedValue(question) },
      remove: { execute: jest.fn().mockResolvedValue(undefined) },
    };
    const res = makeRes();
    res.send = jest.fn().mockReturnValue(res);
    const unused = {} as never;
    const controller = new QuestionController(
      unused, unused, unused,
      useCases.get as never, useCases.approve as never, useCases.reject as never, useCases.remove as never,
      unused,
    );
    return { controller, useCases, res };
  }

  const requester = { id: 7, roleId: 2 };

  it('getById passes the authenticated requester', async () => {
    const { controller, useCases, res } = makeController();
    await controller.getById(teacherReq(), res, jest.fn());
    expect(useCases.get.execute).toHaveBeenCalledWith(5, requester);
  });

  it('approve passes the authenticated requester', async () => {
    const { controller, useCases, res } = makeController();
    await controller.approve(teacherReq(), res, jest.fn());
    expect(useCases.approve.execute).toHaveBeenCalledWith(5, requester);
  });

  it('reject passes the dto and the authenticated requester', async () => {
    const { controller, useCases, res } = makeController();
    await controller.reject(teacherReq(), res, jest.fn());
    expect(useCases.reject.execute).toHaveBeenCalledWith(5, expect.objectContaining({ rejectionReason: 'Unclear' }), requester);
  });

  it('softDelete passes the authenticated requester', async () => {
    const { controller, useCases, res } = makeController();
    await controller.softDelete(teacherReq(), res, jest.fn());
    expect(useCases.remove.execute).toHaveBeenCalledWith(5, requester);
  });

  it('forwards a 403 from the use case to the error handler', async () => {
    const { controller, useCases, res } = makeController();
    const forbidden = CustomError.forbidden('Question does not belong to your school');
    useCases.approve.execute.mockRejectedValueOnce(forbidden);
    const next = jest.fn();

    await controller.approve(teacherReq(), res, next);

    expect(next).toHaveBeenCalledWith(forbidden);
  });
});
