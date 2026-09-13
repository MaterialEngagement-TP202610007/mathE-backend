import { RegisterUserUseCase } from '../../../../../src/domain/use-cases/auth/register-user.use-case.js';
import { RegisterUserDto } from '../../../../../src/domain/dtos/auth/register-user.dto.js';
import { UserEntity } from '../../../../../src/domain/entities/user.entity.js';
import { UserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { PasswordAdapter } from '../../../../../src/domain/adapters/password.adapter.js';
import { CustomError } from '../../../../../src/domain/error/custom-error.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';
import { SchoolRepository } from '../../../../../src/domain/repositories/school.repository.js';
import { SchoolEntity } from '../../../../../src/domain/entities/school.entity.js';

function makeSchoolRepo(exists = true): jest.Mocked<SchoolRepository> {
  return {
    findById: jest.fn().mockResolvedValue(exists ? SchoolEntity.fromObject({ id: 5, cenEdu: 'CLARETIANO' }) : null),
    findAll: jest.fn(),
  } as unknown as jest.Mocked<SchoolRepository>;
}

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

function makeDto(roleId: number = ROLES.TEACHER) {
  const [, dto] = RegisterUserDto.create({
    password: 'Password1',
    email: 'test@example.com',
    name: 'Test User',
    birthDate: '1990-01-01',
    roleId,
    schoolId: 5,
  });
  return dto!;
}

describe('RegisterUserUseCase', () => {
  let repo: jest.Mocked<UserRepository>;
  let passwordAdapter: jest.Mocked<PasswordAdapter>;
  let schoolRepo: jest.Mocked<SchoolRepository>;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    repo = makeRepo();
    passwordAdapter = makePasswordAdapter();
    schoolRepo = makeSchoolRepo();
    useCase = new RegisterUserUseCase(repo, passwordAdapter, schoolRepo);
  });

  it('throws 400 when the school does not exist, without creating the user', async () => {
    repo.findByEmail.mockResolvedValueOnce(null);
    schoolRepo.findById.mockResolvedValueOnce(null);

    await expect(useCase.execute(makeDto())).rejects.toMatchObject({
      statusCode: 400,
      message: 'School not found',
    });
    expect(schoolRepo.findById).toHaveBeenCalledWith(5);
    expect(repo.create).not.toHaveBeenCalled();
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

  it('persists a student as active so it can log in right away', async () => {
    repo.findByEmail.mockResolvedValueOnce(null);
    repo.create.mockResolvedValueOnce(makeEntity());

    await useCase.execute(makeDto(ROLES.STUDENT));

    expect(repo.create.mock.calls[0][0]).toMatchObject({ roleId: ROLES.STUDENT, isActive: true });
  });

  it('persists a teacher as inactive pending administrator approval', async () => {
    repo.findByEmail.mockResolvedValueOnce(null);
    repo.create.mockResolvedValueOnce(makeEntity());

    await useCase.execute(makeDto(ROLES.TEACHER));

    expect(repo.create.mock.calls[0][0]).toMatchObject({ roleId: ROLES.TEACHER, isActive: false });
  });

  it('returns the created user entity', async () => {
    const entity = makeEntity();
    repo.findByEmail.mockResolvedValueOnce(null);
    repo.create.mockResolvedValueOnce(entity);

    const result = await useCase.execute(makeDto());

    expect(result).toBe(entity);
  });
});
