jest.mock('../../../../src/config/database/index.js', () => ({
  prisma: {
    result: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  },
}));

import { prisma } from '../../../../src/config/database/index.js';
import { ResultRepositoryImpl } from '../../../../src/infrastructure/repositories/result.repository.impl.js';
import { PaginationDto } from '../../../../src/domain/dtos/shared/pagination.dto.js';

const findMany = prisma.result.findMany as unknown as jest.Mock;
const count = prisma.result.count as unknown as jest.Mock;

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
});
