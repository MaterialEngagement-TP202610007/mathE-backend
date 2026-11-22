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
      name: 'Test User',
      birthDate: roleId === ROLES.STUDENT ? '2015-03-10' : '1990-01-01',
      roleId,
      schoolId: 5,
      acceptTerms: true,
    },
  } as unknown as Request;
}

function makeController(created: UserEntity) {
  const unused = {} as never;
  const register = {
    execute: jest.fn().mockResolvedValue({
      user: created,
      emailVerificationRequired: false,
      verificationEmailSent: false,
    }),
  };
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
      emailVerificationRequired: false,
      verificationEmailSent: false,
    });
  });

  it('tells a teacher the account is pending administrator approval', async () => {
    const res = makeRes();

    await makeController(makeUser(ROLES.TEACHER, false)).register(makeReq(ROLES.TEACHER), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User created successfully. Your teacher account is pending administrator approval.',
      requiresApproval: true,
      emailVerificationRequired: false,
      verificationEmailSent: false,
    });
  });
});

describe('AuthController email verification endpoints (TP2 CP019)', () => {
  function controllerWith(useCases: unknown) {
    const unused = {} as never;
    return new AuthController(unused, unused, unused, { sessionTtlMs: 1000 }, useCases as never);
  }

  it('answer 404 when the flag is off', async () => {
    const controller = controllerWith(null);
    for (const action of [controller.verifyEmail, controller.resendVerification]) {
      const res = makeRes();
      await action({ body: { email: 'ana@example.com', code: '042917' } } as unknown as Request, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email verification is disabled' });
    }
  });

  it('verify-email validates the body before calling the use case', async () => {
    const verifyEmail = { execute: jest.fn() };
    const res = makeRes();

    await controllerWith({ verifyEmail, sendCode: {} }).verifyEmail(
      { body: { email: 'ana@example.com', code: '12' } } as unknown as Request, res, jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid verification code format' });
    expect(verifyEmail.execute).not.toHaveBeenCalled();
  });

  it('verify-email answers "Email verified" on success', async () => {
    const verifyEmail = { execute: jest.fn().mockResolvedValue(undefined) };
    const res = makeRes();

    await controllerWith({ verifyEmail, sendCode: {} }).verifyEmail(
      { body: { email: 'Ana@Example.com', code: '042917' } } as unknown as Request, res, jest.fn(),
    );

    expect(verifyEmail.execute).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@example.com', code: '042917' }));
    expect(res.json).toHaveBeenCalledWith({ message: 'Email verified' });
  });

  it('verify-email forwards use case errors to the error handler', async () => {
    const failure = new Error('Invalid or expired verification code');
    const verifyEmail = { execute: jest.fn().mockRejectedValue(failure) };
    const next = jest.fn();

    await controllerWith({ verifyEmail, sendCode: {} }).verifyEmail(
      { body: { email: 'ana@example.com', code: '042917' } } as unknown as Request, makeRes(), next,
    );

    expect(next).toHaveBeenCalledWith(failure);
  });

  it('resend answers the same generic message', async () => {
    const sendCode = { execute: jest.fn().mockResolvedValue(undefined) };
    const res = makeRes();

    await controllerWith({ verifyEmail: {}, sendCode }).resendVerification(
      { body: { email: 'ana@example.com' } } as unknown as Request, res, jest.fn(),
    );

    expect(sendCode.execute).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      message: 'If the account exists and is not verified, a new code was sent',
    });
  });
});

