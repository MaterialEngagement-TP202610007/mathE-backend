import { BootstrapAdminUseCase } from '../../../../../src/domain/use-cases/user/bootstrap-admin.use-case.js';
import { BootstrapAdminDto } from '../../../../../src/domain/dtos/user/bootstrap-admin.dto.js';
import { AdminBootstrapRepository } from '../../../../../src/domain/repositories/admin-bootstrap.repository.js';
import { PasswordAdapter } from '../../../../../src/domain/adapters/password.adapter.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

function makeDto(overrides: Record<string, string | undefined> = {}): BootstrapAdminDto {
  const [err, dto] = BootstrapAdminDto.fromEnv({
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'Password1',
    ADMIN_NAME: 'Platform Admin',
    ...overrides,
  });
  if (err) throw new Error(err);
  return dto!;
}

function makeRepo(): jest.Mocked<AdminBootstrapRepository> {
  return {
    findByEmail: jest.fn(),
    createAdmin: jest.fn().mockResolvedValue({ id: 1 }),
    promoteToAdmin: jest.fn().mockResolvedValue({ id: 5 }),
  } as unknown as jest.Mocked<AdminBootstrapRepository>;
}

function makePasswordAdapter(): jest.Mocked<PasswordAdapter> {
  return {
    hash: jest.fn().mockReturnValue('hashed-password'),
    compare: jest.fn(),
  };
}

describe('BootstrapAdminUseCase', () => {
  let repo: jest.Mocked<AdminBootstrapRepository>;
  let passwordAdapter: jest.Mocked<PasswordAdapter>;
  let useCase: BootstrapAdminUseCase;

  beforeEach(() => {
    repo = makeRepo();
    passwordAdapter = makePasswordAdapter();
    useCase = new BootstrapAdminUseCase(repo, passwordAdapter);
  });

  it('creates an active admin with a hashed password when the email is unknown', async () => {
    repo.findByEmail.mockResolvedValueOnce(null);

    const result = await useCase.execute(makeDto());

    expect(passwordAdapter.hash).toHaveBeenCalledWith('Password1');
    expect(repo.createAdmin).toHaveBeenCalledWith({
      email: 'admin@example.com',
      name: 'Platform Admin',
      passwordHash: 'hashed-password',
      roleId: ROLES.ADMIN,
      birthDate: new Date('1970-01-01T00:00:00.000Z'),
    });
    expect(repo.promoteToAdmin).not.toHaveBeenCalled();
    expect(result).toEqual({ userId: 1, created: true, passwordUpdated: true });
  });

  it('promotes an existing user without touching the password by default', async () => {
    repo.findByEmail.mockResolvedValueOnce({ id: 5 });

    const result = await useCase.execute(makeDto());

    expect(passwordAdapter.hash).not.toHaveBeenCalled();
    expect(repo.promoteToAdmin).toHaveBeenCalledWith(5, {
      name: 'Platform Admin',
      roleId: ROLES.ADMIN,
    });
    expect(repo.createAdmin).not.toHaveBeenCalled();
    expect(result).toEqual({ userId: 5, created: false, passwordUpdated: false });
  });

  it('resets the password of an existing user only when resetPassword is set', async () => {
    repo.findByEmail.mockResolvedValueOnce({ id: 5 });

    const result = await useCase.execute(makeDto({ ADMIN_RESET_PASSWORD: 'true' }));

    expect(repo.promoteToAdmin).toHaveBeenCalledWith(5, {
      name: 'Platform Admin',
      roleId: ROLES.ADMIN,
      passwordHash: 'hashed-password',
    });
    expect(result).toEqual({ userId: 5, created: false, passwordUpdated: true });
  });
});
