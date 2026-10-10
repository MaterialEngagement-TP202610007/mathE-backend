import { ExportResultsUseCase } from '../../../../../src/domain/use-cases/result/export-results.use-case.js';
import { ResultRepository } from '../../../../../src/domain/repositories/result.repository.js';
import { SchoolAccessPolicy } from '../../../../../src/domain/policies/school-access.policy.js';
import { Requester } from '../../../../../src/domain/interfaces/shared/requester.interface.js';
import { ResultExportRow } from '../../../../../src/domain/interfaces/result/index.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

const teacher: Requester = { id: 7, roleId: ROLES.TEACHER };

function row(resultDate: string, studentId = 1): ResultExportRow {
  return {
    gradeName: '1ro Primaria',
    gradeLevel: 'Primaria',
    studentId,
    studentName: 'Ana',
    resultDate: new Date(resultDate),
    predominantStyle: 'Visual',
    predominantConfidence: 61.5,
    visualProbability: 61.5,
    auditoryProbability: 20,
    kinestheticProbability: 18.5,
    isMixedProfile: false,
    secondaryStyle: 'Auditory',
    classifierType: 'xgboost',
  };
}

function makeUseCase(rows: ResultExportRow[] = []) {
  const repo = { findForExport: jest.fn().mockResolvedValue(rows) } as unknown as jest.Mocked<ResultRepository>;
  const policy = { assertCanAccessSchool: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<SchoolAccessPolicy>;
  return { repo, policy, useCase: new ExportResultsUseCase(repo, policy) };
}

describe('ExportResultsUseCase (HU-49)', () => {
  it('checks school access, then returns the rows with the requested range', async () => {
    const rows = [row('2026-09-03T10:00:00.000Z')];
    const { repo, policy, useCase } = makeUseCase(rows);
    const from = new Date('2026-09-01T00:00:00.000Z');
    const to = new Date('2026-09-30T23:59:59.999Z');

    const result = await useCase.execute({ schoolId: 8, gradeId: 3, from, to }, teacher);

    expect(policy.assertCanAccessSchool).toHaveBeenCalledWith(teacher, 8);
    expect(repo.findForExport).toHaveBeenCalledWith({ schoolId: 8, gradeId: 3, from, to });
    expect(result).toEqual({ schoolId: 8, gradeId: 3, from, to, rows });
  });

  it('derives an open range from the first and last exported result', async () => {
    const { useCase } = makeUseCase([
      row('2026-09-10T10:00:00.000Z'),
      row('2026-08-01T10:00:00.000Z', 2),
      row('2026-09-20T10:00:00.000Z', 3),
    ]);

    const result = await useCase.execute({ schoolId: 8 }, teacher);

    expect(result.from.toISOString()).toBe('2026-08-01T10:00:00.000Z');
    expect(result.to.toISOString()).toBe('2026-09-20T10:00:00.000Z');
    expect(result.gradeId).toBeNull();
  });

  it('returns 404 when there is nothing to export', async () => {
    const { useCase } = makeUseCase([]);

    await expect(useCase.execute({ schoolId: 8 }, teacher)).rejects.toMatchObject({
      statusCode: 404,
      message: 'No results to export for the selected filters',
    });
  });

  it.each([
    [{ schoolId: 0 }, 'Invalid School Id'],
    [{ schoolId: 8, gradeId: -1 }, 'Invalid Grade Id'],
  ])('rejects %p with 400', async (filters, message) => {
    const { repo, useCase } = makeUseCase([row('2026-09-03T10:00:00.000Z')]);

    await expect(useCase.execute(filters, teacher)).rejects.toMatchObject({ statusCode: 400, message });
    expect(repo.findForExport).not.toHaveBeenCalled();
  });

  it('does not read results when the school check fails', async () => {
    const { repo, policy, useCase } = makeUseCase([row('2026-09-03T10:00:00.000Z')]);
    policy.assertCanAccessSchool.mockRejectedValue(new Error('forbidden'));

    await expect(useCase.execute({ schoolId: 9 }, teacher)).rejects.toThrow('forbidden');
    expect(repo.findForExport).not.toHaveBeenCalled();
  });
});
