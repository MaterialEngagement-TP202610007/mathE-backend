jest.mock('../../../../src/config/database/index.js', () => ({
  prisma: {
    result: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _avg: {} }),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    academicGrade: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

import { prisma } from '../../../../src/config/database/index.js';
import { ResultRepositoryImpl } from '../../../../src/infrastructure/repositories/result.repository.impl.js';
import { PaginationDto } from '../../../../src/domain/dtos/shared/pagination.dto.js';

const findMany = prisma.result.findMany as unknown as jest.Mock;
const count = prisma.result.count as unknown as jest.Mock;
const groupBy = prisma.result.groupBy as unknown as jest.Mock;
const aggregate = prisma.result.aggregate as unknown as jest.Mock;
const userFindMany = prisma.user.findMany as unknown as jest.Mock;
const gradeFindMany = prisma.academicGrade.findMany as unknown as jest.Mock;

const from = new Date('2026-09-01T00:00:00.000Z');
const to = new Date('2026-09-30T23:59:59.999Z');
// HU-51: results are filtered by resultDate; legacy rows without one fall back to createdAt.
const periodWhere = {
  OR: [
    { resultDate: { gte: from, lte: to } },
    { resultDate: null, createdAt: { gte: from, lte: to } },
  ],
};

function pagination(): PaginationDto {
  const [, dto] = PaginationDto.create(1, 10);
  return dto!;
}

describe('ResultRepositoryImpl filters', () => {
  beforeEach(() => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
  });

  describe('findByStudent', () => {
    it('filters by classifierType and date range', async () => {
      const startDate = new Date('2026-09-01T00:00:00.000Z');
      const endDate = new Date('2026-09-13T23:59:59.999Z');

      await new ResultRepositoryImpl().findByStudent(42, pagination(), {
        classifierType: 'xgboost',
        startDate,
        endDate,
      });

      const { where } = findMany.mock.calls[0][0];
      expect(where).toEqual({
        studentId: 42,
        deletedAt: null,
        classifierType: 'xgboost',
        createdAt: { gte: startDate, lte: endDate },
      });
      expect(count).toHaveBeenCalledWith({ where });
    });
  });

  describe('findAll', () => {
    it('combines gradeId and schoolId on the student relation instead of overwriting', async () => {
      await new ResultRepositoryImpl().findAll(pagination(), { gradeId: 3, schoolId: 8 });

      const { where } = findMany.mock.calls[0][0];
      expect(where.student).toEqual({ academicGradeId: 3, schoolId: 8 });
    });

    it('filters by a single student relation condition when only one is given', async () => {
      await new ResultRepositoryImpl().findAll(pagination(), { schoolId: 8 });

      const { where } = findMany.mock.calls[0][0];
      expect(where.student).toEqual({ schoolId: 8 });
    });

    it('omits the student relation filter when neither is given', async () => {
      await new ResultRepositoryImpl().findAll(pagination(), {});

      const { where } = findMany.mock.calls[0][0];
      expect(where).not.toHaveProperty('student');
    });
  });

  describe('report period (HU-51)', () => {
    beforeEach(() => {
      findMany.mockReset().mockResolvedValue([]);
      groupBy.mockReset().mockResolvedValue([]);
      aggregate.mockReset().mockResolvedValue({ _avg: {} });
      userFindMany.mockReset().mockResolvedValue([{ id: 1 }, { id: 2 }]);
      gradeFindMany.mockReset().mockResolvedValue([{ id: 3, name: '1ro Primaria', level: 'Primaria' }]);
    });

    it('findAll filters by result date when startDate/endDate are given', async () => {
      await new ResultRepositoryImpl().findAll(pagination(), { schoolId: 8, startDate: from, endDate: to });

      const { where } = findMany.mock.calls[0][0];
      expect(where).toMatchObject(periodWhere);
      expect(where.student).toEqual({ schoolId: 8 });
    });

    it('findAll supports an open-ended range', async () => {
      await new ResultRepositoryImpl().findAll(pagination(), { startDate: from });

      const { where } = findMany.mock.calls[0][0];
      expect(where.OR).toEqual([
        { resultDate: { gte: from } },
        { resultDate: null, createdAt: { gte: from } },
      ]);
    });

    it('findAll adds no date condition without a range', async () => {
      await new ResultRepositoryImpl().findAll(pagination(), {});

      const { where } = findMany.mock.calls[0][0];
      expect(where).not.toHaveProperty('OR');
    });

    it('getSchoolStats applies the period to every result query', async () => {
      await new ResultRepositoryImpl().getSchoolStats(8, { from, to });

      expect(findMany.mock.calls[0][0].where).toMatchObject(periodWhere);
      expect(groupBy.mock.calls[0][0].where).toMatchObject(periodWhere);
      expect(aggregate.mock.calls[0][0].where).toMatchObject(periodWhere);
    });

    it('getStatsByGrade applies the period to every result query', async () => {
      await new ResultRepositoryImpl().getStatsByGrade(8, undefined, { from, to });

      expect(findMany.mock.calls[0][0].where).toMatchObject(periodWhere);
      expect(aggregate.mock.calls[0][0].where).toMatchObject(periodWhere);
    });
  });
});
