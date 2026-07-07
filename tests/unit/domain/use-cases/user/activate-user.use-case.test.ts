import { ActivateUserUseCase } from '../../../../../src/domain/use-cases/user/activate-user.use-case.js';
import { UserEntity } from '../../../../../src/domain/entities/user.entity.js';
import { UserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { NotificationRepository } from '../../../../../src/domain/repositories/notification.repository.js';
import { CustomError } from '../../../../../src/domain/error/custom-error.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

function makeUser(overrides: Partial<{
  id: number; isActive: boolean; roleId: number; deletedAt: Date | null;
}> = {}): UserEntity {
  const defaults = { id: 1, isActive: false, roleId: ROLES.STUDENT, deletedAt: null };
  const opts = { ...defaults, ...overrides };
  return new UserEntity(
    opts.id, 'hashed', `user${opts.id}@example.com`, 'Test User',
    new Date('2000-01-01'), new Date(), new Date(),
    null, opts.isActive, opts.roleId, null, null, opts.deletedAt,
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

function makeNotificationRepo(): jest.Mocked<NotificationRepository> {
  return {
    create: jest.fn().mockResolvedValue({}),
    findByStudent: jest.fn(),
    findById: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    countUnread: jest.fn(),
  } as unknown as jest.Mocked<NotificationRepository>;
}

describe('ActivateUserUseCase', () => {
  let repo: jest.Mocked<UserRepository>;
  let notificationRepo: jest.Mocked<NotificationRepository>;
  let useCase: ActivateUserUseCase;

  beforeEach(() => {
    repo = makeRepo();
    notificationRepo = makeNotificationRepo();
    useCase = new ActivateUserUseCase(repo, notificationRepo);
  });

  it('throws 404 when user not found', async () => {
    repo.findById.mockResolvedValueOnce(null);
    await expect(useCase.execute(99)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when user is deleted', async () => {
    repo.findById.mockResolvedValueOnce(makeUser({ deletedAt: new Date() }));
    await expect(useCase.execute(1)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when user is already active', async () => {
    repo.findById.mockResolvedValueOnce(makeUser({ isActive: true }));
    await expect(useCase.execute(1)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 403 when teacher tries to activate non-student', async () => {
    repo.findById.mockResolvedValueOnce(makeUser({ roleId: ROLES.TEACHER }));
    await expect(useCase.execute(1, ROLES.TEACHER)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows teacher to activate student', async () => {
    const student = makeUser({ roleId: ROLES.STUDENT });
    const activated = makeUser({ roleId: ROLES.STUDENT, isActive: true });
    repo.findById.mockResolvedValueOnce(student);
    repo.setActive.mockResolvedValueOnce(activated);

    const result = await useCase.execute(1, ROLES.TEACHER);

    expect(result.isActive).toBe(true);
    expect(repo.setActive).toHaveBeenCalledWith(1, true);
  });

  it('activates student without caller role restriction', async () => {
    const student = makeUser({ roleId: ROLES.STUDENT });
    const activated = makeUser({ isActive: true });
    repo.findById.mockResolvedValueOnce(student);
    repo.setActive.mockResolvedValueOnce(activated);

    await useCase.execute(1);

    expect(repo.setActive).toHaveBeenCalledWith(1, true);
  });

  it('creates notification after activation', async () => {
    const student = makeUser({ roleId: ROLES.STUDENT });
    const activated = makeUser({ isActive: true });
    repo.findById.mockResolvedValueOnce(student);
    repo.setActive.mockResolvedValueOnce(activated);

    await useCase.execute(1);

    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 1, type: 'account_activated' }),
    );
  });

  it('sends teacher-specific message when activating a teacher account', async () => {
    const teacher = makeUser({ id: 5, roleId: ROLES.TEACHER });
    const activated = makeUser({ id: 5, roleId: ROLES.TEACHER, isActive: true });
    repo.findById.mockResolvedValueOnce(teacher);
    repo.setActive.mockResolvedValueOnce(activated);

    await useCase.execute(5);

    const call = notificationRepo.create.mock.calls[0][0];
    expect(call.message).toContain('gestionar alumnos');
  });

  it('sends student-specific message when activating a student account', async () => {
    const student = makeUser({ id: 3, roleId: ROLES.STUDENT });
    const activated = makeUser({ id: 3, roleId: ROLES.STUDENT, isActive: true });
    repo.findById.mockResolvedValueOnce(student);
    repo.setActive.mockResolvedValueOnce(activated);

    await useCase.execute(3);

    const call = notificationRepo.create.mock.calls[0][0];
    expect(call.message).toContain('cuestionario');
  });
});
