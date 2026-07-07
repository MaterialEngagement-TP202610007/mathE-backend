import { RegisterUserUseCase } from '../../../../../src/domain/use-cases/auth/register-user.use-case.js';
import { RegisterUserDto } from '../../../../../src/domain/dtos/auth/register-user.dto.js';
import { UserEntity } from '../../../../../src/domain/entities/user.entity.js';
import { UserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { PasswordAdapter } from '../../../../../src/domain/adapters/password.adapter.js';
import { CustomError } from '../../../../../src/domain/error/custom-error.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

function makeEntity(): UserEntity {
  return new UserEntity(
    1, 'hashed', 'test@example.com', 'Test User',
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
  return {
    hash: jest.fn().mockReturnValue('hashed'),
    compare: jest.fn(),
  } as jest.Mocked<PasswordAdapter>;
}

function makeDto() {
  const [, dto] = RegisterUserDto.create({
    password: 'Password1',
    email: 'test@example.com',
    name: 'Test User',
    birthDate: '1990-01-01',
    roleId: ROLES.TEACHER,
  });
  return dto!;
}

describe('RegisterUserUseCase', () => {
  let repo: jest.Mocked<UserRepository>;
  let passwordAdapter: jest.Mocked<PasswordAdapter>;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    repo = makeRepo();
    passwordAdapter = makePasswordAdapter();
    useCase = new RegisterUserUseCase(repo, passwordAdapter);
  });

  it('throws 400 when email already registered', async () => {
    repo.findByEmail.mockResolvedValue(makeEntity());
    await expect(useCase.execute(makeDto())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('checks email before creating', async () => {
    repo.findByEmail.mockResolvedValueOnce(makeEntity());
    await expect(useCase.execute(makeDto())).rejects.toThrow();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('hashes password before storing', async () => {
    repo.findByEmail.mockResolvedValueOnce(null);
    repo.create.mockResolvedValueOnce(makeEntity());

    await useCase.execute(makeDto());

    expect(passwordAdapter.hash).toHaveBeenCalledWith('Password1');
  });

  it('calls repository create with hashed password', async () => {
    repo.findByEmail.mockResolvedValueOnce(null);
    repo.create.mockResolvedValueOnce(makeEntity());

    await useCase.execute(makeDto());

    expect(repo.create).toHaveBeenCalledTimes(1);
    const arg = repo.create.mock.calls[0][0];
    expect(arg.password).toBe('hashed');
  });

  it('returns the created user entity', async () => {
    const entity = makeEntity();
    repo.findByEmail.mockResolvedValueOnce(null);
    repo.create.mockResolvedValueOnce(entity);

    const result = await useCase.execute(makeDto());

    expect(result).toBe(entity);
  });
});
