jest.mock('../../../../src/config/database/index.js', () => ({
  prisma: {
    user: { findMany: jest.fn(), count: jest.fn() },
  },
}));

import { prisma } from '../../../../src/config/database/index.js';
import { UserRepositoryImpl } from '../../../../src/infrastructure/repositories/user.repository.impl.js';
import { PaginationDto } from '../../../../src/domain/dtos/shared/pagination.dto.js';

const mocked = prisma as unknown as {
  user: { findMany: jest.Mock; count: jest.Mock };
};

const row = {
  id: 5,
  password: 'hash',
  email: 'teacher@example.com',
  name: 'Teacher',
  birthDate: new Date('1990-01-01'),
  phoneNumber: null,
  isActive: false,
  roleId: 2,
  academicGradeId: null,
  schoolId: 4,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  school: { cenEdu: 'Colegio X' },
};

describe('UserRepositoryImpl.findAll', () => {
  beforeEach(() => {
    mocked.user.findMany.mockResolvedValue([row]);
    mocked.user.count.mockResolvedValue(1);
  });

  it('filters by role and isActive, paginates, and loads the school name', async () => {
    const [, pagination] = PaginationDto.create(2, 5);

    const result = await new UserRepositoryImpl().findAll(pagination!, { roleId: 2, isActive: false });

    const args = mocked.user.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ deletedAt: null, roleId: 2, isActive: false });
    expect(args.skip).toBe(5);
    expect(args.take).toBe(5);
    expect(args.include).toEqual({ school: { select: { cenEdu: true } } });
    expect(mocked.user.count).toHaveBeenCalledWith({ where: args.where });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ id: 5, schoolId: 4, schoolName: 'Colegio X' });
  });
});

describe('UserRepositoryImpl.findAll search (HU-37)', () => {
  beforeEach(() => {
    mocked.user.findMany.mockResolvedValue([row]);
    mocked.user.count.mockResolvedValue(1);
  });

  it('matches name or email case-insensitively and keeps the other filters', async () => {
    const [, pagination] = PaginationDto.create(1, 10);

    await new UserRepositoryImpl().findAll(pagination!, { roleId: 3, schoolId: 4, search: 'ana' });

    const args = mocked.user.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ deletedAt: null, roleId: 3, schoolId: 4 });
    expect(args.where.OR).toEqual([
      { name: { contains: 'ana', mode: 'insensitive' } },
      { email: { contains: 'ana', mode: 'insensitive' } },
    ]);
    expect(mocked.user.count).toHaveBeenCalledWith({ where: args.where });
  });

  it('also matches the exact numeric id when the term is a number', async () => {
    const [, pagination] = PaginationDto.create(1, 10);

    await new UserRepositoryImpl().findAll(pagination!, { roleId: 3, search: '42' });

    const args = mocked.user.findMany.mock.calls[0][0];
    expect(args.where.OR).toEqual([
      { name: { contains: '42', mode: 'insensitive' } },
      { email: { contains: '42', mode: 'insensitive' } },
      { id: 42 },
    ]);
  });

  it('adds no OR clause without a search term', async () => {
    const [, pagination] = PaginationDto.create(1, 10);

    await new UserRepositoryImpl().findAll(pagination!, { roleId: 3 });

    expect(mocked.user.findMany.mock.calls[0][0].where.OR).toBeUndefined();
  });
});
