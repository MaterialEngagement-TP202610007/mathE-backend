import { UpdateUserProfileUseCase } from '../../../../../src/domain/use-cases/user/update-user-profile.use-case.js';
import { UpdateUserDto } from '../../../../../src/domain/dtos/user/update-user.dto.js';
import { UserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { SchoolRepository } from '../../../../../src/domain/repositories/school.repository.js';
import { UserEntity } from '../../../../../src/domain/entities/user.entity.js';
import { SchoolEntity } from '../../../../../src/domain/entities/school.entity.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

function makeUser(roleId: number, schoolId: number | null = 1): UserEntity {
  return new UserEntity(
    7, 'hash', 'user@example.com', 'User', new Date('2000-01-01'),
    new Date(), new Date(), null, true, roleId, null, schoolId, null,
  );
}

function setup(user: UserEntity | null, schoolExists = true) {
  const users = {
    findById: jest.fn().mockResolvedValue(user),
    update: jest.fn().mockResolvedValue(user),
  } as unknown as jest.Mocked<UserRepository>;
  const schools = {
    findById: jest.fn().mockResolvedValue(
      schoolExists ? SchoolEntity.fromObject({ id: 2, cenEdu: 'CLARETIANO' }) : null,
    ),
  } as unknown as jest.Mocked<SchoolRepository>;
  return { users, schools, useCase: new UpdateUserProfileUseCase(users, schools) };
}

const dto = (body: Record<string, unknown>) => UpdateUserDto.create(body)[1]!;

describe('UpdateUserProfileUseCase school rules', () => {
  it.each([ROLES.STUDENT, ROLES.TEACHER])('rejects removing the school of role %s', async (roleId) => {
    const { users, useCase } = setup(makeUser(roleId));

    await expect(useCase.execute(7, dto({ schoolId: null }))).rejects.toMatchObject({
      statusCode: 400,
      message: 'Students and teachers must belong to a school',
    });
    expect(users.update).not.toHaveBeenCalled();
  });

  it('lets an admin account clear its school', async () => {
    const { users, useCase } = setup(makeUser(ROLES.ADMIN));

    await useCase.execute(7, dto({ schoolId: null }));

    expect(users.update).toHaveBeenCalled();
  });

  it('allows changing to an existing school', async () => {
    const { users, schools, useCase } = setup(makeUser(ROLES.TEACHER));

    await useCase.execute(7, dto({ schoolId: 2 }));

    expect(schools.findById).toHaveBeenCalledWith(2);
    expect(users.update).toHaveBeenCalledWith(7, expect.objectContaining({ schoolId: 2 }));
  });

  it('rejects a school that does not exist', async () => {
    const { users, useCase } = setup(makeUser(ROLES.STUDENT), false);

    await expect(useCase.execute(7, dto({ schoolId: 999 }))).rejects.toMatchObject({
      statusCode: 400,
      message: 'School not found',
    });
    expect(users.update).not.toHaveBeenCalled();
  });

  it('does not look up schools when schoolId is not being changed', async () => {
    const { schools, users, useCase } = setup(makeUser(ROLES.STUDENT));

    await useCase.execute(7, dto({ name: 'Renamed' }));

    expect(schools.findById).not.toHaveBeenCalled();
    expect(users.update).toHaveBeenCalled();
  });

  it('returns 404 for an unknown user', async () => {
    const { useCase } = setup(null);

    await expect(useCase.execute(7, dto({ name: 'x' }))).rejects.toMatchObject({ statusCode: 404 });
  });
});
