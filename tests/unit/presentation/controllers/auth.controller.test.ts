import { Request, Response } from 'express';
import { AuthController } from '../../../../src/presentation/controllers/auth.controller.js';
import { UserEntity } from '../../../../src/domain/entities/user.entity.js';
import { ROLES } from '../../../../src/domain/constants/roles.constant.js';

function makeUser(roleId: number, isActive: boolean): UserEntity {
  return new UserEntity(
    1, 'hashed', 'user@example.com', 'User', new Date('2000-01-01'),
    new Date(), new Date(), null, isActive, roleId, null, 5, null,
  );
}

function makeRes(): jest.Mocked<Response> {
  const res = {} as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(roleId: number): Request {
  return {
    body: {
      password: 'Password1',
      email: 'user@example.com',
      name: 'User',
      birthDate: '2000-01-01',
      roleId,
      schoolId: 5,
    },
  } as unknown as Request;
}

function makeController(created: UserEntity) {
  const unused = {} as never;
  const register = { execute: jest.fn().mockResolvedValue(created) };
  return new AuthController(unused, register as never, unused, { sessionTtlMs: 1000 });
}

describe('AuthController.register', () => {
  it('tells a student the account is ready (no approval needed)', async () => {
    const res = makeRes();

    await makeController(makeUser(ROLES.STUDENT, true)).register(makeReq(ROLES.STUDENT), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User created successfully',
      requiresApproval: false,
    });
  });

  it('tells a teacher the account is pending administrator approval', async () => {
    const res = makeRes();

    await makeController(makeUser(ROLES.TEACHER, false)).register(makeReq(ROLES.TEACHER), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User created successfully. Your teacher account is pending administrator approval.',
      requiresApproval: true,
    });
  });
});
