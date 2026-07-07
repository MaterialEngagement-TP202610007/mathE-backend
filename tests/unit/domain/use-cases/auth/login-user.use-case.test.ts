import { LoginUserUseCase } from '../../../../../src/domain/use-cases/auth/login-user.use-case.js';
import { LoginUserDto } from '../../../../../src/domain/dtos/auth/login-user.dto.js';
import { UserEntity } from '../../../../../src/domain/entities/user.entity.js';
import { UserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { PasswordAdapter } from '../../../../../src/domain/adapters/password.adapter.js';
import { TokenAdapter } from '../../../../../src/domain/adapters/token.adapter.js';
import { CustomError } from '../../../../../src/domain/error/custom-error.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

function makeActiveUser(): UserEntity {
  return new UserEntity(
    1, 'hashed', 'user@example.com', 'Active User',
    new Date('1990-01-01'), new Date(), new Date(),
    null, true, ROLES.TEACHER, null, null, null,
  );
}

function makeInactiveUser(): UserEntity {
  return new UserEntity(
    2, 'hashed', 'inactive@example.com', 'Inactive User',
    new Date('1990-01-01'), new Date(), new Date(),
    null, false, ROLES.TEACHER, null, null, null,
  );
}

function makeRepo(): jest.Mocked<UserRepository> {
  return {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    setActive: jest.fn(),
  } as unknown as jest.Mocked<UserRepository>;
}

function makePasswordAdapter(): jest.Mocked<PasswordAdapter> {
  return { hash: jest.fn(), compare: jest.fn() } as jest.Mocked<PasswordAdapter>;
}

function makeTokenAdapter(): jest.Mocked<TokenAdapter> {
  return { generate: jest.fn(), verify: jest.fn() } as jest.Mocked<TokenAdapter>;
}

const [, validDto] = LoginUserDto.create({
  email: 'user@example.com',
  password: 'Password1',
});

describe('LoginUserUseCase', () => {
  let repo: jest.Mocked<UserRepository>;
  let passwordAdapter: jest.Mocked<PasswordAdapter>;
  let tokenAdapter: jest.Mocked<TokenAdapter>;
  let useCase: LoginUserUseCase;

  beforeEach(() => {
    repo = makeRepo();
    passwordAdapter = makePasswordAdapter();
    tokenAdapter = makeTokenAdapter();
    useCase = new LoginUserUseCase(repo, passwordAdapter, tokenAdapter);
  });

  it('throws 400 when user not found', async () => {
    repo.findByEmail.mockResolvedValueOnce(null);
    await expect(useCase.execute(validDto!)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 401 when account is inactive', async () => {
    repo.findByEmail.mockResolvedValueOnce(makeInactiveUser());
    await expect(useCase.execute(validDto!)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('inactive account error message mentions administrator', async () => {
    repo.findByEmail.mockResolvedValueOnce(makeInactiveUser());
    await expect(useCase.execute(validDto!)).rejects.toMatchObject({
      message: expect.stringContaining('administrator'),
    });
  });

  it('throws 400 when password is wrong', async () => {
    repo.findByEmail.mockResolvedValueOnce(makeActiveUser());
    passwordAdapter.compare.mockReturnValueOnce(false);
    await expect(useCase.execute(validDto!)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 500 when token generation fails', async () => {
    repo.findByEmail.mockResolvedValueOnce(makeActiveUser());
    passwordAdapter.compare.mockReturnValueOnce(true);
    tokenAdapter.generate.mockResolvedValueOnce(null);
    await expect(useCase.execute(validDto!)).rejects.toMatchObject({ statusCode: 500 });
  });

  it('returns user and token on success', async () => {
    const user = makeActiveUser();
    repo.findByEmail.mockResolvedValueOnce(user);
    passwordAdapter.compare.mockReturnValueOnce(true);
    tokenAdapter.generate.mockResolvedValueOnce('jwt-token');

    const result = await useCase.execute(validDto!);

    expect(result.user).toBe(user);
    expect(result.token).toBe('jwt-token');
  });

  it('calls token adapter with user id, email, roleId', async () => {
    const user = makeActiveUser();
    repo.findByEmail.mockResolvedValueOnce(user);
    passwordAdapter.compare.mockReturnValueOnce(true);
    tokenAdapter.generate.mockResolvedValueOnce('jwt-token');

    await useCase.execute(validDto!);

    expect(tokenAdapter.generate).toHaveBeenCalledWith({
      id: user.id,
      email: user.email,
      roleId: user.roleId,
    });
  });
});
