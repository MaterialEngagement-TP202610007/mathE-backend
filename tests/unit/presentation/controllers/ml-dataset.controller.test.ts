import { Request, Response } from 'express';
import { MLDatasetController } from '../../../../src/presentation/controllers/ml-dataset.controller.js';

function makeRes(): jest.Mocked<Response> {
  const res = {} as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('MLDatasetController.listAll', () => {
  it('passes the schoolId filter and the authenticated requester', async () => {
    const dataset = { execute: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }) };
    const controller = new MLDatasetController(dataset as never, {} as never);
    const req = { query: { schoolId: '3' }, user: { id: 7, email: 't@example.com', roleId: 2 } } as unknown as Request;

    await controller.listAll(req, makeRes(), jest.fn());

    const [, filters, requester] = dataset.execute.mock.calls[0];
    expect(filters.schoolId).toBe(3);
    expect(requester).toEqual({ id: 7, roleId: 2 });
  });
});
