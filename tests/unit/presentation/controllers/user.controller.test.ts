import { Request, Response } from 'express';
import { UserController } from '../../../../src/presentation/controllers/user.controller.js';
import { UserEntity } from '../../../../src/domain/entities/user.entity.js';

function makeUser(id = 1): UserEntity {
  return new UserEntity(
    id, '$2a$10$secret-hash', `user${id}@example.com`, 'User', new Date('2000-01-01'),
    new Date(), new Date(), null, true, 3, null, null, null,
  );
}

function makeRes(): jest.Mocked<Response> {
  const res = {} as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    params: { id: '1', schoolId: '4' },
    query: {},
    body: { name: 'New Name' },
    user: { id: 1, email: 'admin@example.com', roleId: 1 },
    ...overrides,
  } as unknown as Request;
}

function body(res: jest.Mocked<Response>) {
  return JSON.parse(JSON.stringify(res.json.mock.calls[0][0]));
}

describe('UserController never exposes password hashes', () => {
  const page = { items: [makeUser(1), makeUser(2)], total: 2, page: 1, limit: 10 };
  const useCase = (value: unknown) => ({ execute: jest.fn().mockResolvedValue(value) });

  function makeController() {
    return new UserController(
      useCase(page) as never,
      useCase(page) as never,
      useCase(page) as never,
      useCase(page) as never,
      useCase(makeUser()) as never,
      useCase(makeUser()) as never,
      useCase(makeUser()) as never,
      useCase(makeUser()) as never,
    );
  }

  it.each(['getAll', 'getStudents', 'getTeachers', 'getStudentsBySchool'] as const)(
    '%s returns paginated users without password',
    async (handler) => {
      const res = makeRes();
      await makeController()[handler](makeReq(), res, jest.fn());

      const payload = body(res);
      expect(payload.total).toBe(2);
      expect(payload.items).toHaveLength(2);
      for (const item of payload.items) expect(item).not.toHaveProperty('password');
    },
  );

  it.each(['getById', 'updateProfile'] as const)('%s returns the user without password', async (handler) => {
    const res = makeRes();
    await makeController()[handler](makeReq(), res, jest.fn());

    const payload = body(res);
    expect(payload.email).toBe('user1@example.com');
    expect(payload).not.toHaveProperty('password');
  });

  it.each([
    ['delete', 'User deleted'],
    ['activate', 'User activated'],
  ] as const)('%s returns the user without password', async (handler, message) => {
    const res = makeRes();
    await makeController()[handler](makeReq(), res, jest.fn());

    const payload = body(res);
    expect(payload.message).toBe(message);
    expect(payload.user.email).toBe('user1@example.com');
    expect(payload.user).not.toHaveProperty('password');
  });
});
