import { Request, Response } from 'express';
import { SchoolController } from '../../../../src/presentation/controllers/school.controller.js';
import { SchoolEntity } from '../../../../src/domain/entities/school.entity.js';

function makeRes(): jest.Mocked<Response> {
  const res = {} as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const school = SchoolEntity.fromObject({
  id: 1593,
  institutionKey: 'LOC-337988-CLARETIANO',
  cenEdu: 'CLARETIANO',
  district: 'SAN MIGUEL',
  address: 'AV',
  businessName: '',
  levels: ['Primaria', 'Secundaria'],
  codMods: ['0331041', '0336743'],
});

describe('SchoolController.listAll', () => {
  it('forwards search and district filters and returns one item per school', async () => {
    const list = { execute: jest.fn().mockResolvedValue({ items: [school], total: 1, page: 1, limit: 50 }) };
    const controller = new SchoolController(list as never, {} as never);
    const res = makeRes();
    const req = { query: { search: 'claretiano', district: 'san miguel', limit: '50' } } as unknown as Request;

    await controller.listAll(req, res, jest.fn());

    const [pagination, filters] = list.execute.mock.calls[0];
    expect(pagination.limit).toBe(50);
    expect(filters).toEqual({ search: 'claretiano', district: 'san miguel' });
    const body = JSON.parse(JSON.stringify(res.json.mock.calls[0][0]));
    expect(body.items[0]).toMatchObject({ levels: ['Primaria', 'Secundaria'], codMods: ['0331041', '0336743'] });
    expect(body.items[0]).not.toHaveProperty('codMod');
    expect(body.items[0]).not.toHaveProperty('level');
  });
});
