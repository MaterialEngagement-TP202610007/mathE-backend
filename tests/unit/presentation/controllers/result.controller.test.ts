import { Request, Response } from 'express';
import { ResultController } from '../../../../src/presentation/controllers/result.controller.js';

function makeRes(): jest.Mocked<Response> {
  const res = {} as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ResultController student result listings', () => {
  let studentResults: { execute: jest.Mock };
  let controller: ResultController;

  beforeEach(() => {
    studentResults = { execute: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 }) };
    const unused = {} as never;
    controller = new ResultController(
      unused, unused, studentResults as never, unused, unused, unused, unused, unused, unused,
    );
  });

  const query = {
    classifierType: 'xgboost',
    predominantStyle: 'Visual',
    startDate: '2026-09-01',
    endDate: '2026-09-13',
  };

  it('getByStudent forwards classifierType and a whole-day endDate', async () => {
    const req = {
      params: { studentId: '42' },
      query,
      user: { id: 7, roleId: 2 },
    } as unknown as Request;

    await controller.getByStudent(req, makeRes(), jest.fn());

    const [studentId, , filters] = studentResults.execute.mock.calls[0];
    expect(studentId).toBe(42);
    expect(filters.classifierType).toBe('xgboost');
    expect(filters.predominantStyle).toBe('Visual');
    expect(filters.startDate.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(filters.endDate.toISOString()).toBe('2026-09-13T23:59:59.999Z');
  });

  it('listMine uses the same filter normalization for the authenticated student', async () => {
    const req = { params: {}, query, user: { id: 9, roleId: 3 } } as unknown as Request;

    await controller.listMine(req, makeRes(), jest.fn());

    const [studentId, , filters] = studentResults.execute.mock.calls[0];
    expect(studentId).toBe(9);
    expect(filters.endDate.toISOString()).toBe('2026-09-13T23:59:59.999Z');
  });

  it('returns 400 for an invalid endDate', async () => {
    const res = makeRes();
    const req = { params: { studentId: '42' }, query: { endDate: 'nope' }, user: { id: 7, roleId: 2 } } as unknown as Request;

    await controller.getByStudent(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid endDate' });
    expect(studentResults.execute).not.toHaveBeenCalled();
  });
});
