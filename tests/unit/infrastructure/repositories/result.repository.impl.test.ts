jest.mock('../../../../src/config/database/index.js', () => ({
  prisma: {
    result: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _avg: {} }),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    questionnaire: { count: jest.fn().mockResolvedValue(0) },
    mLDataset: { aggregate: jest.fn().mockResolvedValue({ _avg: { avgQuestionTime: null } }) },
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
const questionnaireCount = prisma.questionnaire.count as unknown as jest.Mock;
const datasetAggregate = prisma.mLDataset.aggregate as unknown as jest.Mock;

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

  describe('getStatsByGrade style distribution (HU-48)', () => {
    beforeEach(() => {
      findMany.mockReset();
      aggregate.mockReset().mockResolvedValue({
        _avg: { visualProbability: 50, auditoryProbability: 30, kinestheticProbability: 20 },
      });
      gradeFindMany.mockReset().mockResolvedValue([
        { id: 3, name: '1ro Primaria', level: 'Primaria' },
        { id: 4, name: '2do Primaria', level: 'Primaria' },
      ]);
      userFindMany.mockReset().mockImplementation(({ where }: { where: { academicGradeId: number } }) =>
        Promise.resolve(where.academicGradeId === 3 ? [{ id: 1 }, { id: 2 }, { id: 5 }] : []),
      );
    });

    it("counts each student once by the predominant style of their latest result in range", async () => {
      // Newest first, as requested by the repository.
      findMany.mockResolvedValue([
        { studentId: 1, predominantStyle: 'Auditory' },
        { studentId: 2, predominantStyle: 'Visual' },
        { studentId: 1, predominantStyle: 'Visual' },
        { studentId: 5, predominantStyle: 'Visual' }, // mixed profile: counted by predominant style
      ]);

      const [grade, empty] = await new ResultRepositoryImpl().getStatsByGrade(8, undefined, { from, to });

      expect(findMany.mock.calls[0][0]).toMatchObject({
        select: { studentId: true, predominantStyle: true },
        orderBy: [{ resultDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      });
      expect(grade).toEqual({
        gradeId: 3,
        gradeName: '1ro Primaria',
        level: 'Primaria',
        evaluatedStudents: 3,
        avgVisualProbability: 50,
        avgAuditoryProbability: 30,
        avgKinestheticProbability: 20,
        styleCounts: { Visual: 2, Auditory: 1, Kinesthetic: 0 },
      });
      expect(empty.evaluatedStudents).toBe(0);
      expect(empty.styleCounts).toEqual({ Visual: 0, Auditory: 0, Kinesthetic: 0 });
    });

    it('keeps zero counts for a grade whose students have no results in range', async () => {
      findMany.mockResolvedValue([]);
      aggregate.mockResolvedValue({ _avg: { visualProbability: null, auditoryProbability: null, kinestheticProbability: null } });

      const [grade] = await new ResultRepositoryImpl().getStatsByGrade(8);

      expect(grade.evaluatedStudents).toBe(0);
      expect(grade.styleCounts).toEqual({ Visual: 0, Auditory: 0, Kinesthetic: 0 });
      expect(grade.avgVisualProbability).toBeNull();
    });
  });

  describe('getSchoolStats questionnaire stats (HU-50)', () => {
    beforeEach(() => {
      findMany.mockReset().mockResolvedValue([{ studentId: 1 }]);
      groupBy.mockReset().mockResolvedValue([{ predominantStyle: 'Visual' }]);
      aggregate.mockReset().mockResolvedValue({ _avg: { predominantConfidence: 70 } });
      userFindMany.mockReset().mockResolvedValue([{ id: 1 }, { id: 2 }]);
      questionnaireCount.mockReset().mockImplementation(({ where }: { where: { status?: string } }) =>
        Promise.resolve(where.status === 'completed' ? 3 : 4),
      );
      datasetAggregate.mockReset().mockResolvedValue({ _avg: { avgQuestionTime: 12.5 } });
    });

    it('adds average response time and completion rate for questionnaires started in the period', async () => {
      const stats = await new ResultRepositoryImpl().getSchoolStats(8, { from, to });

      expect(stats).toEqual({
        schoolId: 8,
        evaluatedStudents: 1,
        mostCommonStyle: 'Visual',
        avgPredominantConfidence: 70,
        startedQuestionnaires: 4,
        completedQuestionnaires: 3,
        completionRate: 0.75,
        avgResponseTimeSeconds: 12.5,
      });
      const startedWhere = {
        deletedAt: null,
        studentId: { in: [1, 2] },
        startTime: { gte: from, lte: to },
      };
      expect(questionnaireCount).toHaveBeenCalledWith({ where: startedWhere });
      expect(questionnaireCount).toHaveBeenCalledWith({ where: { ...startedWhere, status: 'completed' } });
      expect(datasetAggregate).toHaveBeenCalledWith({
        where: { questionnaire: { ...startedWhere, status: 'completed' } },
        _avg: { avgQuestionTime: true },
      });
    });

    it('returns null averages when no questionnaire was completed', async () => {
      questionnaireCount.mockImplementation(({ where }: { where: { status?: string } }) =>
        Promise.resolve(where.status === 'completed' ? 0 : 2),
      );
      datasetAggregate.mockResolvedValue({ _avg: { avgQuestionTime: null } });

      const stats = await new ResultRepositoryImpl().getSchoolStats(8);

      expect(stats.completedQuestionnaires).toBe(0);
      expect(stats.startedQuestionnaires).toBe(2);
      expect(stats.completionRate).toBe(0);
      expect(stats.avgResponseTimeSeconds).toBeNull();
      expect(questionnaireCount.mock.calls[0][0].where).not.toHaveProperty('startTime');
    });

    it('returns zero counts and null rates when nothing was started', async () => {
      questionnaireCount.mockResolvedValue(0);
      datasetAggregate.mockResolvedValue({ _avg: { avgQuestionTime: null } });

      const stats = await new ResultRepositoryImpl().getSchoolStats(8, { from, to });

      expect(stats).toMatchObject({
        startedQuestionnaires: 0,
        completedQuestionnaires: 0,
        completionRate: null,
        avgResponseTimeSeconds: null,
      });
    });

    it('returns the empty shape for a school without students', async () => {
      userFindMany.mockResolvedValue([]);

      const stats = await new ResultRepositoryImpl().getSchoolStats(8);

      expect(stats).toEqual({
        schoolId: 8,
        evaluatedStudents: 0,
        mostCommonStyle: null,
        avgPredominantConfidence: null,
        startedQuestionnaires: 0,
        completedQuestionnaires: 0,
        completionRate: null,
        avgResponseTimeSeconds: null,
      });
      expect(questionnaireCount).not.toHaveBeenCalled();
    });
  });
});
