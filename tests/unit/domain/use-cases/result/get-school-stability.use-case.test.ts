import { GetSchoolStabilityUseCase } from '../../../../../src/domain/use-cases/result/get-school-stability.use-case.js';
import { stabilityProfile } from '../../../../../src/domain/use-cases/result/stability-profile.js';
import { ResultRepository } from '../../../../../src/domain/repositories/result.repository.js';
import { SchoolAccessPolicy } from '../../../../../src/domain/policies/school-access.policy.js';
import { Requester } from '../../../../../src/domain/interfaces/shared/requester.interface.js';
import { StabilityResultRow } from '../../../../../src/domain/interfaces/result/index.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

const teacher: Requester = { id: 7, roleId: ROLES.TEACHER };

function row(
  studentId: number,
  predominantStyle: 'Visual' | 'Auditory' | 'Kinesthetic',
  resultDate: string,
): StabilityResultRow {
  return {
    studentId,
    studentName: `Student ${studentId}`,
    gradeId: 3,
    gradeName: '1ro Primaria',
    predominantStyle,
    resultDate: new Date(resultDate),
  };
}

function makeUseCase(rows: StabilityResultRow[] = []) {
  const repo = { findForStability: jest.fn().mockResolvedValue(rows) } as unknown as jest.Mocked<ResultRepository>;
  const policy = { assertCanAccessSchool: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<SchoolAccessPolicy>;
  return { repo, policy, useCase: new GetSchoolStabilityUseCase(repo, policy) };
}

describe('stabilityProfile (HU-38)', () => {
  it.each([
    [0, 0, null],
    [1, 1, null],
    [2, 2, 'stable'],
    [3, 5, 'stable'],
    [1, 2, 'variable'],
    [2, 4, 'variable'],
    [0, 3, 'variable'],
  ])('topCount %i of %i results → %p', (topCount, total, expected) => {
    expect(stabilityProfile(topCount, total)).toBe(expected);
  });
});

describe('GetSchoolStabilityUseCase (HU-38)', () => {
  it('checks school access and forwards grade and period to the repository', async () => {
    const { repo, policy, useCase } = makeUseCase();
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-10-10T23:59:59.999Z');

    await useCase.execute({ schoolId: 8, gradeId: 3, from, to }, teacher);

    expect(policy.assertCanAccessSchool).toHaveBeenCalledWith(teacher, 8);
    expect(repo.findForStability).toHaveBeenCalledWith({ schoolId: 8, gradeId: 3, from, to });
  });

  it('reports per student variations between consecutive results and a summary', async () => {
    const { useCase } = makeUseCase([
      row(1, 'Visual', '2026-03-01T10:00:00.000Z'),
      row(1, 'Visual', '2026-06-01T10:00:00.000Z'),
      row(1, 'Visual', '2026-09-01T10:00:00.000Z'),
      row(2, 'Visual', '2026-03-02T10:00:00.000Z'),
      row(2, 'Auditory', '2026-06-02T10:00:00.000Z'),
      row(2, 'Visual', '2026-09-02T10:00:00.000Z'),
      row(2, 'Kinesthetic', '2026-10-02T10:00:00.000Z'),
      row(3, 'Kinesthetic', '2026-09-05T10:00:00.000Z'),
    ]);

    const report = await useCase.execute({ schoolId: 8 }, teacher);

    expect(report.schoolId).toBe(8);
    expect(report.gradeId).toBeNull();
    expect(report.summary).toEqual({ students: 3, stable: 1, variable: 1, insufficientData: 1 });
    expect(report.students).toEqual([
      {
        studentId: 1, studentName: 'Student 1', gradeId: 3, gradeName: '1ro Primaria',
        resultsCount: 3, firstStyle: 'Visual', lastStyle: 'Visual', changes: 0,
        profile: 'stable', lastResultDate: new Date('2026-09-01T10:00:00.000Z'),
      },
      {
        studentId: 2, studentName: 'Student 2', gradeId: 3, gradeName: '1ro Primaria',
        resultsCount: 4, firstStyle: 'Visual', lastStyle: 'Kinesthetic', changes: 3,
        profile: 'variable', lastResultDate: new Date('2026-10-02T10:00:00.000Z'),
      },
      {
        studentId: 3, studentName: 'Student 3', gradeId: 3, gradeName: '1ro Primaria',
        resultsCount: 1, firstStyle: 'Kinesthetic', lastStyle: 'Kinesthetic', changes: 0,
        profile: null, lastResultDate: new Date('2026-09-05T10:00:00.000Z'),
      },
    ]);
  });

  it('returns an empty report (not 404) when no student has results in range', async () => {
    const { useCase } = makeUseCase([]);

    const report = await useCase.execute({ schoolId: 8, gradeId: 2 }, teacher);

    expect(report).toEqual({
      schoolId: 8,
      gradeId: 2,
      summary: { students: 0, stable: 0, variable: 0, insufficientData: 0 },
      students: [],
    });
  });

  it.each([
    [{ schoolId: 0 }, 'Invalid School Id'],
    [{ schoolId: 8, gradeId: 1.5 }, 'Invalid Grade Id'],
  ])('rejects %p with 400 before touching the repository', async (filters, message) => {
    const { repo, policy, useCase } = makeUseCase();

    await expect(useCase.execute(filters, teacher)).rejects.toMatchObject({ statusCode: 400, message });
    expect(policy.assertCanAccessSchool).not.toHaveBeenCalled();
    expect(repo.findForStability).not.toHaveBeenCalled();
  });
});
