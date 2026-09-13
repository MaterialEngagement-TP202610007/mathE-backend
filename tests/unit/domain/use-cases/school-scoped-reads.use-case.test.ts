import { GetStudentsBySchoolUseCase } from '../../../../src/domain/use-cases/user/get-students-by-school.use-case.js';
import { GetSchoolStatsUseCase } from '../../../../src/domain/use-cases/result/get-school-stats.use-case.js';
import { GetStatsByGradeUseCase } from '../../../../src/domain/use-cases/result/get-stats-by-grade.use-case.js';
import { GetAllResultsUseCase } from '../../../../src/domain/use-cases/result/get-all-results.use-case.js';
import { GetDatasetUseCase } from '../../../../src/domain/use-cases/ml-dataset/get-dataset.use-case.js';
import { SchoolAccessPolicy } from '../../../../src/domain/policies/school-access.policy.js';
import { UserRepository } from '../../../../src/domain/repositories/user.repository.js';
import { ResultRepository } from '../../../../src/domain/repositories/result.repository.js';
import { MLDatasetRepository } from '../../../../src/domain/repositories/ml-dataset.repository.js';
import { UserEntity } from '../../../../src/domain/entities/user.entity.js';
import { PaginationDto } from '../../../../src/domain/dtos/shared/pagination.dto.js';
import { Requester } from '../../../../src/domain/interfaces/shared/requester.interface.js';
import { ROLES } from '../../../../src/domain/constants/roles.constant.js';

const OWN_SCHOOL = 1;
const OTHER_SCHOOL = 2;
const page = { items: [], total: 0, page: 1, limit: 10 };
const [, pagination] = PaginationDto.create(1, 10);

const teacher: Requester = { id: 10, roleId: ROLES.TEACHER };
const admin: Requester = { id: 1, roleId: ROLES.ADMIN };

function makeUserRepo(): jest.Mocked<UserRepository> {
  const teacherEntity = new UserEntity(
    10, 'hash', 'teacher@example.com', 'Teacher', new Date('1990-01-01'),
    new Date(), new Date(), null, true, ROLES.TEACHER, null, OWN_SCHOOL, null,
  );
  return {
    findById: jest.fn(async (id: number) => (id === 10 ? teacherEntity : null)),
    findAll: jest.fn().mockResolvedValue(page),
  } as unknown as jest.Mocked<UserRepository>;
}

function makeResultRepo(): jest.Mocked<ResultRepository> {
  return {
    getSchoolStats: jest.fn().mockResolvedValue({ schoolId: OWN_SCHOOL }),
    getStatsByGrade: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue(page),
  } as unknown as jest.Mocked<ResultRepository>;
}

function makeDatasetRepo(): jest.Mocked<MLDatasetRepository> {
  return { findAll: jest.fn().mockResolvedValue(page) } as unknown as jest.Mocked<MLDatasetRepository>;
}

type Harness = { run: (schoolId: number, requester: Requester) => Promise<unknown>; read: () => jest.MockInstance<any, any> };

function harnesses(): Record<string, () => Harness> {
  return {
    'students by school': () => {
      const users = makeUserRepo();
      const useCase = new GetStudentsBySchoolUseCase(users, new SchoolAccessPolicy(users));
      return { run: (id, r) => useCase.execute(id, pagination!, undefined, r), read: () => users.findAll };
    },
    'school stats': () => {
      const results = makeResultRepo();
      const useCase = new GetSchoolStatsUseCase(results, new SchoolAccessPolicy(makeUserRepo()));
      return { run: (id, r) => useCase.execute(id, r), read: () => results.getSchoolStats };
    },
    'stats by grade': () => {
      const results = makeResultRepo();
      const useCase = new GetStatsByGradeUseCase(results, new SchoolAccessPolicy(makeUserRepo()));
      return { run: (id, r) => useCase.execute(id, undefined, r), read: () => results.getStatsByGrade };
    },
    'results filtered by schoolId': () => {
      const results = makeResultRepo();
      const useCase = new GetAllResultsUseCase(results, new SchoolAccessPolicy(makeUserRepo()));
      return { run: (id, r) => useCase.execute(pagination!, { schoolId: id }, r), read: () => results.findAll };
    },
    'ml dataset filtered by schoolId': () => {
      const dataset = makeDatasetRepo();
      const useCase = new GetDatasetUseCase(dataset, new SchoolAccessPolicy(makeUserRepo()));
      return { run: (id, r) => useCase.execute(pagination!, { schoolId: id }, r), read: () => dataset.findAll };
    },
  };
}

describe.each(Object.entries(harnesses()))('%s', (_name, make) => {
  it('allows a teacher to read their own school', async () => {
    const h = make();
    await h.run(OWN_SCHOOL, teacher);
    expect(h.read()).toHaveBeenCalled();
  });

  it('returns 403 to a teacher for another school without reading data', async () => {
    const h = make();
    await expect(h.run(OTHER_SCHOOL, teacher)).rejects.toMatchObject({
      statusCode: 403,
      message: 'You can only access data from your own school',
    });
    expect(h.read()).not.toHaveBeenCalled();
  });

  it('allows an admin to read any school', async () => {
    const h = make();
    await h.run(OTHER_SCHOOL, admin);
    expect(h.read()).toHaveBeenCalled();
  });
});

describe('unfiltered listings stay available to teachers', () => {
  it('GetAllResultsUseCase does not check school access without a schoolId filter', async () => {
    const results = makeResultRepo();
    const users = makeUserRepo();
    await new GetAllResultsUseCase(results, new SchoolAccessPolicy(users)).execute(pagination!, {}, teacher);
    expect(results.findAll).toHaveBeenCalled();
    expect(users.findById).not.toHaveBeenCalled();
  });
});
