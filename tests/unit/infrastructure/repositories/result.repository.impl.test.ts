jest.mock('../../../../src/config/database/index.js', () => ({
  prisma: {
    result: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _avg: {} }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
    user: { findMany: jest.fn().mockResolvedValue([]) },
    questionnaire: { count: jest.fn().mockResolvedValue(0) },
    mLDataset: {
      aggregate: jest.fn().mockResolvedValue({ _avg: { avgQuestionTime: null } }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
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

  describe('findForExport (HU-49)', () => {
    beforeEach(() => findMany.mockReset());

    it('selects only report columns for the school, grade and period, ordered by grade and student', async () => {
      findMany.mockResolvedValue([
        {
          resultDate: null,
          createdAt: new Date('2026-09-02T08:00:00.000Z'),
          predominantStyle: 'Visual',
          predominantConfidence: 70,
          visualProbability: 70,
          auditoryProbability: 20,
          kinestheticProbability: 10,
          isMixedProfile: false,
          secondaryStyle: 'Auditory',
          classifierType: 'xgboost',
          student: { id: 12, name: 'Ana', academicGrade: { name: '1ro Primaria', level: 'Primaria' } },
        },
        {
          resultDate: new Date('2026-09-03T08:00:00.000Z'),
          createdAt: new Date('2026-09-03T08:00:00.000Z'),
          predominantStyle: 'Auditory',
          predominantConfidence: null,
          visualProbability: null,
          auditoryProbability: null,
          kinestheticProbability: null,
          isMixedProfile: true,
          secondaryStyle: null,
          classifierType: null,
          student: { id: 13, name: 'Beto', academicGrade: null },
        },
      ]);

      const rows = await new ResultRepositoryImpl().findForExport({ schoolId: 8, gradeId: 3, from, to });

      const args = findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        deletedAt: null,
        predominantStyle: { not: null },
        student: { schoolId: 8, deletedAt: null, academicGradeId: 3 },
        ...periodWhere,
      });
      expect(args.select.student).toEqual({
        select: { id: true, name: true, academicGrade: { select: { name: true, level: true } } },
      });
      expect(JSON.stringify(args.select)).not.toMatch(/password|email|mvi/i);
      expect(args.orderBy).toEqual([
        { student: { academicGrade: { order: 'asc' } } },
        { student: { name: 'asc' } },
        { resultDate: { sort: 'asc', nulls: 'first' } },
        { createdAt: 'asc' },
      ]);
      expect(rows).toEqual([
        {
          gradeName: '1ro Primaria',
          gradeLevel: 'Primaria',
          studentId: 12,
          studentName: 'Ana',
          resultDate: new Date('2026-09-02T08:00:00.000Z'),
          predominantStyle: 'Visual',
          predominantConfidence: 70,
          visualProbability: 70,
          auditoryProbability: 20,
          kinestheticProbability: 10,
          isMixedProfile: false,
          secondaryStyle: 'Auditory',
          classifierType: 'xgboost',
        },
        {
          gradeName: null,
          gradeLevel: null,
          studentId: 13,
          studentName: 'Beto',
          resultDate: new Date('2026-09-03T08:00:00.000Z'),
          predominantStyle: 'Auditory',
          predominantConfidence: null,
          visualProbability: null,
          auditoryProbability: null,
          kinestheticProbability: null,
          isMixedProfile: true,
          secondaryStyle: null,
          classifierType: null,
        },
      ]);
    });

    it('omits the grade and date conditions when not requested', async () => {
      findMany.mockResolvedValue([]);

      await new ResultRepositoryImpl().findForExport({ schoolId: 8 });

      const { where } = findMany.mock.calls[0][0];
      expect(where.student).toEqual({ schoolId: 8, deletedAt: null });
      expect(where).not.toHaveProperty('OR');
    });
  });
});

describe('ResultRepositoryImpl stability (HU-38)', () => {
  describe('getUserStats', () => {
    it('gives no profile to a student with a single result', async () => {
      count.mockResolvedValueOnce(1);
      groupBy.mockResolvedValueOnce([{ predominantStyle: 'Visual', _count: { predominantStyle: 1 } }]);

      const stats = await new ResultRepositoryImpl().getUserStats(5);

      expect(stats).toEqual({ userId: 5, total: 1, predominantStyle: 'Visual', profile: null });
    });

    it('keeps "Estable" / "Variable" from two results on', async () => {
      count.mockResolvedValueOnce(2);
      groupBy.mockResolvedValueOnce([{ predominantStyle: 'Visual', _count: { predominantStyle: 2 } }]);
      expect((await new ResultRepositoryImpl().getUserStats(5)).profile).toBe('Estable');

      count.mockResolvedValueOnce(2);
      groupBy.mockResolvedValueOnce([
        { predominantStyle: 'Visual', _count: { predominantStyle: 1 } },
        { predominantStyle: 'Auditory', _count: { predominantStyle: 1 } },
      ]);
      expect((await new ResultRepositoryImpl().getUserStats(5)).profile).toBe('Variable');
    });
  });

  describe('findForStability', () => {
    it('loads school (and grade) results in the period grouped by grade, name and student, oldest first', async () => {
      findMany.mockResolvedValueOnce([
        {
          resultDate: null,
          createdAt: new Date('2026-09-02T10:00:00.000Z'),
          predominantStyle: 'Auditory',
          student: { id: 12, name: 'Ana', academicGradeId: 3, academicGrade: { name: '1ro Primaria' } },
        },
      ]);

      const rows = await new ResultRepositoryImpl().findForStability({ schoolId: 8, gradeId: 3, from, to });

      const args = findMany.mock.calls[0][0];
      expect(args.where).toMatchObject({
        deletedAt: null,
        predominantStyle: { not: null },
        student: { schoolId: 8, deletedAt: null, academicGradeId: 3 },
        ...periodWhere,
      });
      expect(args.select).not.toHaveProperty('mviResult');
      expect(args.orderBy).toEqual([
        { student: { academicGrade: { order: 'asc' } } },
        { student: { name: 'asc' } },
        { studentId: 'asc' },
        { resultDate: { sort: 'asc', nulls: 'first' } },
        { createdAt: 'asc' },
      ]);
      expect(rows).toEqual([
        {
          studentId: 12,
          studentName: 'Ana',
          gradeId: 3,
          gradeName: '1ro Primaria',
          predominantStyle: 'Auditory',
          resultDate: new Date('2026-09-02T10:00:00.000Z'),
        },
      ]);
    });
  });
});

describe('ResultRepositoryImpl label correction (HU-44)', () => {
  const findFirst = prisma.result.findFirst as unknown as jest.Mock;
  const update = prisma.result.update as unknown as jest.Mock;
  const transaction = prisma.$transaction as unknown as jest.Mock;
  const datasetUpdateMany = prisma.mLDataset.updateMany as unknown as jest.Mock;
  const corrector = { correctingTeacher: { select: { id: true, name: true } } };
  const correctedAt = new Date('2026-10-10T12:00:00.000Z');
  const stored = {
    id: 10, questionnaireId: 20, studentId: 30,
    correctedVakLabel: 'Auditory', correctedAt, correctingTeacherId: 7,
    correctingTeacher: { id: 7, name: 'Profe Ana' },
  };

  it('stores who corrected and when, and returns them', async () => {
    transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
    findFirst.mockResolvedValueOnce({ id: 10, questionnaireId: 20, studentId: 30 });
    update.mockResolvedValueOnce(stored);

    const entity = await new ResultRepositoryImpl().correctLabel({
      resultId: 10, teacherId: 7, vakLabel: 'Auditory', correctedAt,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { correctedVakLabel: 'Auditory', correctingTeacherId: 7, correctedAt },
      include: corrector,
    });
    expect(datasetUpdateMany).toHaveBeenCalledWith({
      where: { questionnaireId: 20 },
      data: { vakLabel: 'Auditory', labelSource: 'teacher_validated' },
    });
    expect(entity).toMatchObject({ correctedVakLabel: 'Auditory', correctedAt, correctedBy: { id: 7, name: 'Profe Ana' } });
  });

  it('loads the corrector with a single result', async () => {
    findFirst.mockResolvedValueOnce(stored);

    const entity = await new ResultRepositoryImpl().findById(10);

    expect(findFirst.mock.calls[0][0].include).toEqual(corrector);
    expect(entity!.correctedBy).toEqual({ id: 7, name: 'Profe Ana' });
  });

  it('loads the corrector in teacher result lists', async () => {
    findMany.mockResolvedValueOnce([stored]);
    count.mockResolvedValueOnce(1);

    const page = await new ResultRepositoryImpl().findAll(pagination(), {});

    expect(findMany.mock.calls[0][0].include).toEqual(corrector);
    expect(page.items[0].correctedVakLabel).toBe('Auditory');
  });

  it.each([
    ['corrected', { correctedVakLabel: { not: null } }],
    ['uncorrected', { correctedVakLabel: null }],
  ] as const)('filters findAll by labelStatus=%s', async (labelStatus, expected) => {
    findMany.mockResolvedValueOnce([]);

    await new ResultRepositoryImpl().findAll(pagination(), { labelStatus });

    expect(findMany.mock.calls[0][0].where).toMatchObject(expected);
  });
});
