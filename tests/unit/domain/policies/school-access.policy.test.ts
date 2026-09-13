import { SchoolAccessPolicy } from '../../../../src/domain/policies/school-access.policy.js';
import { UserRepository } from '../../../../src/domain/repositories/user.repository.js';
import { UserEntity } from '../../../../src/domain/entities/user.entity.js';
import { ROLES } from '../../../../src/domain/constants/roles.constant.js';

function makeUser(id: number, roleId: number, schoolId: number | null): UserEntity {
  return new UserEntity(
    id, 'hash', `user${id}@example.com`, 'User', new Date('2000-01-01'),
    new Date(), new Date(), null, true, roleId, null, schoolId, null,
  );
}

function makeUserRepo(users: UserEntity[]): jest.Mocked<UserRepository> {
  return {
    findById: jest.fn(async (id: number) => users.find((u) => u.id === id) ?? null),
  } as unknown as jest.Mocked<UserRepository>;
}

const TEACHER_A = makeUser(10, ROLES.TEACHER, 1);
const TEACHER_NO_SCHOOL = makeUser(11, ROLES.TEACHER, null);

describe('SchoolAccessPolicy.assertCanAccessSchool', () => {
  const policy = new SchoolAccessPolicy(makeUserRepo([TEACHER_A, TEACHER_NO_SCHOOL]));

  it('lets an admin access any school without loading the user', async () => {
    const repo = makeUserRepo([]);
    await expect(
      new SchoolAccessPolicy(repo).assertCanAccessSchool({ id: 1, roleId: ROLES.ADMIN }, 999),
    ).resolves.toBeUndefined();
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('lets a teacher access their own school (school loaded from the repository)', async () => {
    await expect(
      policy.assertCanAccessSchool({ id: 10, roleId: ROLES.TEACHER }, 1),
    ).resolves.toBeUndefined();
  });

  it('forbids a teacher from another school', async () => {
    await expect(
      policy.assertCanAccessSchool({ id: 10, roleId: ROLES.TEACHER }, 2),
    ).rejects.toMatchObject({ statusCode: 403, message: 'You can only access data from your own school' });
  });

  it('forbids a teacher without school', async () => {
    await expect(
      policy.assertCanAccessSchool({ id: 11, roleId: ROLES.TEACHER }, 1),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('forbids an unknown teacher', async () => {
    await expect(
      policy.assertCanAccessSchool({ id: 404, roleId: ROLES.TEACHER }, 1),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it.each([ROLES.STUDENT, null])('forbids role %s', async (roleId) => {
    await expect(policy.assertCanAccessSchool({ id: 10, roleId }, 1)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('SchoolAccessPolicy.assertCanManageQuestion', () => {
  const policy = new SchoolAccessPolicy(makeUserRepo([TEACHER_A, TEACHER_NO_SCHOOL]));

  it('lets an admin manage any question, including fallback ones without school', async () => {
    await expect(
      policy.assertCanManageQuestion({ id: 1, roleId: ROLES.ADMIN }, { schoolId: null }),
    ).resolves.toBeUndefined();
  });

  it('lets a teacher manage a question of their school', async () => {
    await expect(
      policy.assertCanManageQuestion({ id: 10, roleId: ROLES.TEACHER }, { schoolId: 1 }),
    ).resolves.toBeUndefined();
  });

  it('forbids a teacher from managing another school question', async () => {
    await expect(
      policy.assertCanManageQuestion({ id: 10, roleId: ROLES.TEACHER }, { schoolId: 2 }),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Question does not belong to your school' });
  });

  it('forbids a teacher from managing a question without school', async () => {
    await expect(
      policy.assertCanManageQuestion({ id: 10, roleId: ROLES.TEACHER }, { schoolId: null }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('forbids a teacher without school even for questions without school', async () => {
    await expect(
      policy.assertCanManageQuestion({ id: 11, roleId: ROLES.TEACHER }, { schoolId: null }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
