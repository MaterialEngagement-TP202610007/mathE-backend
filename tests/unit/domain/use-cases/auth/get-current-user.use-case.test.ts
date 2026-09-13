import { GetCurrentUserUseCase } from '../../../../../src/domain/use-cases/auth/get-current-user.use-case.js';
import { UserEntity } from '../../../../../src/domain/entities/user.entity.js';
import { UserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

function makeUser(isActive: boolean, roleId: number = ROLES.TEACHER): UserEntity {
  return new UserEntity(
    1, 'hashed', 'user@example.com', 'User', new Date('1990-01-01'),
    new Date(), new Date(), null, isActive, roleId, null, null, null,
  );
}

function makeRepo(): jest.Mocked<UserRepository> {
  return { findById: jest.fn() } as unknown as jest.Mocked<UserRepository>;
}

describe('GetCurrentUserUseCase', () => {
  let repo: jest.Mocked<UserRepository>;
  let useCase: GetCurrentUserUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new GetCurrentUserUseCase(repo);
  });

  it('returns the active user', async () => {
    const user = makeUser(true, ROLES.STUDENT);
    repo.findById.mockResolvedValueOnce(user);
    await expect(useCase.execute(1)).resolves.toBe(user);
  });

  it('throws 401 when the user no longer exists', async () => {
    repo.findById.mockResolvedValueOnce(null);
    await expect(useCase.execute(1)).rejects.toMatchObject({ statusCode: 401, message: 'Invalid session' });
  });

  it('throws 401 with the pending approval message for an inactive teacher', async () => {
    repo.findById.mockResolvedValueOnce(makeUser(false));
    await expect(useCase.execute(1)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Account is inactive. Your teacher account is pending administrator approval.',
    });
  });
});
