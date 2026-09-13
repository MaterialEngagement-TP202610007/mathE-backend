import { ActivateUserUseCase } from '../../../../../src/domain/use-cases/user/activate-user.use-case.js';
import { UserEntity } from '../../../../../src/domain/entities/user.entity.js';
import { UserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { NotificationRepository } from '../../../../../src/domain/repositories/notification.repository.js';
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

  it('admin activates a pending teacher', async () => {
    const teacher = makeUser({ id: 5, roleId: ROLES.TEACHER });
    const activated = makeUser({ id: 5, roleId: ROLES.TEACHER, isActive: true });
    repo.findById.mockResolvedValueOnce(teacher);
    repo.setActive.mockResolvedValueOnce(activated);

    const result = await useCase.execute(5, ROLES.ADMIN);

    expect(result.isActive).toBe(true);
    expect(repo.setActive).toHaveBeenCalledWith(5, true);
  });

  it('creates an account_activated notification with the teacher message', async () => {
    repo.findById.mockResolvedValueOnce(makeUser({ id: 5, roleId: ROLES.TEACHER }));
    repo.setActive.mockResolvedValueOnce(makeUser({ id: 5, roleId: ROLES.TEACHER, isActive: true }));

    await useCase.execute(5, ROLES.ADMIN);

    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 5, type: 'account_activated' }),
    );
    expect(notificationRepo.create.mock.calls[0][0].message).toContain('gestionar alumnos');
  });

  it.each([ROLES.TEACHER, ROLES.STUDENT, undefined])(
    'throws 403 when the caller role is %p (only admins can activate)',
    async (callerRoleId) => {
      repo.findById.mockResolvedValueOnce(makeUser({ roleId: ROLES.TEACHER }));

      await expect(useCase.execute(1, callerRoleId)).rejects.toMatchObject({ statusCode: 403 });
      expect(repo.setActive).not.toHaveBeenCalled();
    },
  );

  it('throws 404 when user not found', async () => {
    repo.findById.mockResolvedValueOnce(null);
    await expect(useCase.execute(99, ROLES.ADMIN)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when user is deleted', async () => {
    repo.findById.mockResolvedValueOnce(makeUser({ roleId: ROLES.TEACHER, deletedAt: new Date() }));
    await expect(useCase.execute(1, ROLES.ADMIN)).rejects.toMatchObject({ statusCode: 400 });
  });

  it.each([
    ['student', ROLES.STUDENT],
    ['admin', ROLES.ADMIN],
  ])('throws 400 when the target is a %s', async (_label, roleId) => {
    repo.findById.mockResolvedValueOnce(makeUser({ roleId, isActive: true }));

    await expect(useCase.execute(1, ROLES.ADMIN)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Only teacher accounts require activation',
    });
    expect(repo.setActive).not.toHaveBeenCalled();
    expect(notificationRepo.create).not.toHaveBeenCalled();
  });

  it('throws 400 when the teacher is already active', async () => {
    repo.findById.mockResolvedValueOnce(makeUser({ roleId: ROLES.TEACHER, isActive: true }));
    await expect(useCase.execute(1, ROLES.ADMIN)).rejects.toMatchObject({
      statusCode: 400,
      message: 'User is already active',
    });
  });
});
