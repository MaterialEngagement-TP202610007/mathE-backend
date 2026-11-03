import { Request, Response } from 'express';
import { QuestionnaireController } from '../../../../src/presentation/controllers/questionnaire.controller.js';

function makeRes(): jest.Mocked<Response> {
  const res = {} as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('QuestionnaireController.saveProgress (HU-29 S1)', () => {
  let saveProgress: { execute: jest.Mock };
  let controller: QuestionnaireController;

  beforeEach(() => {
    saveProgress = { execute: jest.fn().mockResolvedValue({ questionnaireId: 10, answers: [] }) };
    const unused = {} as never;
    controller = new QuestionnaireController(
      unused, unused, unused, unused, unused, unused, saveProgress as never,
    );
  });

  const body = { answers: [{ questionId: 101, selectedOptionId: 1011 }] };

  it('forwards the questionnaire id, the authenticated student and the parsed answers', async () => {
    const req = { params: { id: '10' }, body, user: { id: 3, roleId: 3 } } as unknown as Request;
    const res = makeRes();

    await controller.saveProgress(req, res, jest.fn());

    const [id, studentId, dto] = saveProgress.execute.mock.calls[0];
    expect(id).toBe(10);
    expect(studentId).toBe(3);
    expect(dto.answers[0]).toMatchObject({ questionId: 101, selectedOptionId: 1011 });
    expect(res.json).toHaveBeenCalledWith({ questionnaireId: 10, answers: [] });
  });

  it('returns 400 for an invalid questionnaire id', async () => {
    const req = { params: { id: 'abc' }, body, user: { id: 3, roleId: 3 } } as unknown as Request;
    const res = makeRes();

    await controller.saveProgress(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(saveProgress.execute).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid body', async () => {
    const req = { params: { id: '10' }, body: { answers: [] }, user: { id: 3, roleId: 3 } } as unknown as Request;
    const res = makeRes();

    await controller.saveProgress(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(saveProgress.execute).not.toHaveBeenCalled();
  });

  it('passes use case errors to next', async () => {
    const failure = new Error('boom');
    saveProgress.execute.mockRejectedValueOnce(failure);
    const req = { params: { id: '10' }, body, user: { id: 3, roleId: 3 } } as unknown as Request;
    const next = jest.fn();

    await controller.saveProgress(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});
