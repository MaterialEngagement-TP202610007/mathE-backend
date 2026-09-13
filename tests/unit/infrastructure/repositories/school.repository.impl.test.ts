jest.mock('../../../../src/config/database/index.js', () => ({
  prisma: {
    school: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
  },
}));

import { prisma } from '../../../../src/config/database/index.js';
import { SchoolRepositoryImpl } from '../../../../src/infrastructure/repositories/school.repository.impl.js';
import { PaginationDto } from '../../../../src/domain/dtos/shared/pagination.dto.js';

const mocked = prisma as unknown as {
  school: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
};

const row = {
  id: 1593,
  institutionKey: 'LOC-337988-CLARETIANO',
  cenEdu: 'CLARETIANO',
  district: 'SAN MIGUEL',
  address: 'AV',
  businessName: '',
  levels: ['Primaria', 'Secundaria'],
  codMods: ['0331041', '0336743'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SchoolRepositoryImpl.findAll', () => {
  beforeEach(() => {
    mocked.school.findMany.mockResolvedValue([row]);
    mocked.school.count.mockResolvedValue(1);
  });

  it('searches by name and district, case-insensitively, one row per school', async () => {
    const [, pagination] = PaginationDto.create(2, 50);

    const result = await new SchoolRepositoryImpl().findAll(pagination!, {
      search: ' claretiano ',
      district: 'san miguel',
    });

    const args = mocked.school.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      cenEdu: { contains: 'claretiano', mode: 'insensitive' },
      district: { contains: 'san miguel', mode: 'insensitive' },
    });
    expect(args.skip).toBe(50);
    expect(args.take).toBe(50);
    expect(args.orderBy).toEqual([{ cenEdu: 'asc' }, { district: 'asc' }, { id: 'asc' }]);
    expect(mocked.school.count.mock.calls[0][0].where).toEqual(args.where);
    expect(result.items[0].levels).toEqual(['Primaria', 'Secundaria']);
    expect(result.total).toBe(1);
  });

  it('ignores blank filters', async () => {
    const [, pagination] = PaginationDto.create(1, 10);

    await new SchoolRepositoryImpl().findAll(pagination!, { search: '   ', district: '' });

    expect(mocked.school.findMany.mock.calls[0][0].where).toEqual({});
  });
});
