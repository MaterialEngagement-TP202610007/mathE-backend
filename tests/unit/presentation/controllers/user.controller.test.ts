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

describe('UserController.getStudentsBySchool', () => {
  it('passes the authenticated requester so the use case can enforce school scope', async () => {
    const bySchool = { execute: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 }) };
    const unused = {} as never;
    const controller = new UserController(unused, unused, unused, bySchool as never, unused, unused, unused, unused);
    const req = makeReq({ user: { id: 7, email: 't@example.com', roleId: 2 } } as Partial<Request>);

    await controller.getStudentsBySchool(req, makeRes(), jest.fn());

    const [schoolId, , , requester] = bySchool.execute.mock.calls[0];
    expect(schoolId).toBe(4);
    expect(requester).toEqual({ id: 7, roleId: 2 });
  });
});

describe('UserController.getTeachers', () => {
  it('forwards the isActive filter and returns each teacher with its school', async () => {
    const teacher = new UserEntity(
      5, 'hash', 'teacher@example.com', 'Teacher', new Date('1990-01-01'),
      new Date(), new Date(), null, false, 2, null, 4, null, 'Colegio X',
    );
    const noSchool = new UserEntity(
      6, 'hash', 'orphan@example.com', 'Orphan', new Date('1990-01-01'),
      new Date(), new Date(), null, false, 2, null, null, null,
    );
    const teachers = { execute: jest.fn().mockResolvedValue({ items: [teacher, noSchool], total: 2, page: 2, limit: 5 }) };
    const unused = {} as never;
    const controller = new UserController(unused, unused, teachers as never, unused, unused, unused, unused, unused);
    const res = makeRes();

    await controller.getTeachers(makeReq({ query: { isActive: 'false', page: '2', limit: '5' } } as Partial<Request>), res, jest.fn());

    const [pagination, filters] = teachers.execute.mock.calls[0];
    expect(pagination).toMatchObject({ page: 2, limit: 5 });
    expect(filters.isActive).toBe(false);

    const payload = body(res);
    expect(payload).toMatchObject({ total: 2, page: 2, limit: 5 });
    expect(payload.items[0]).toMatchObject({ id: 5, schoolId: 4, isActive: false, school: { id: 4, name: 'Colegio X' } });
    expect(payload.items[0]).not.toHaveProperty('password');
    expect(payload.items[1].school).toBeNull();
  });
});
