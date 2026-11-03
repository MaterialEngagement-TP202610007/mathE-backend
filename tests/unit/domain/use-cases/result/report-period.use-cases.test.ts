import { GetSchoolStatsUseCase } from '../../../../../src/domain/use-cases/result/get-school-stats.use-case.js';
import { GetStatsByGradeUseCase } from '../../../../../src/domain/use-cases/result/get-stats-by-grade.use-case.js';
import { ResultRepository } from '../../../../../src/domain/repositories/result.repository.js';
import { SchoolAccessPolicy } from '../../../../../src/domain/policies/school-access.policy.js';
import { Requester } from '../../../../../src/domain/interfaces/shared/requester.interface.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

const teacher: Requester = { id: 7, roleId: ROLES.TEACHER };
const period = { from: new Date('2026-09-01T00:00:00.000Z'), to: new Date('2026-09-30T23:59:59.999Z') };

function makeDeps() {
  const repo = {
    getSchoolStats: jest.fn().mockResolvedValue({ schoolId: 8 }),
    getStatsByGrade: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<ResultRepository>;
  const policy = { assertCanAccessSchool: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<SchoolAccessPolicy>;
  return { repo, policy };
}

describe('Report use cases honor the HU-51 period', () => {
  it('GetSchoolStatsUseCase forwards the period after the school check', async () => {
    const { repo, policy } = makeDeps();

    await new GetSchoolStatsUseCase(repo, policy).execute(8, teacher, period);

    expect(policy.assertCanAccessSchool).toHaveBeenCalledWith(teacher, 8);
    expect(repo.getSchoolStats).toHaveBeenCalledWith(8, period);
  });

  it('GetSchoolStatsUseCase defaults to an open period', async () => {
    const { repo, policy } = makeDeps();

    await new GetSchoolStatsUseCase(repo, policy).execute(8, teacher);

    expect(repo.getSchoolStats).toHaveBeenCalledWith(8, {});
  });

  it('GetStatsByGradeUseCase forwards level and period', async () => {
    const { repo, policy } = makeDeps();

    await new GetStatsByGradeUseCase(repo, policy).execute(8, 'Primaria', teacher, period);

    expect(repo.getStatsByGrade).toHaveBeenCalledWith(8, 'Primaria', period);
  });

  it('GetStatsByGradeUseCase does not query when the school check fails', async () => {
    const { repo, policy } = makeDeps();
    policy.assertCanAccessSchool.mockRejectedValue(new Error('forbidden'));

    await expect(new GetStatsByGradeUseCase(repo, policy).execute(8, undefined, teacher, period)).rejects.toThrow('forbidden');
    expect(repo.getStatsByGrade).not.toHaveBeenCalled();
  });
});
