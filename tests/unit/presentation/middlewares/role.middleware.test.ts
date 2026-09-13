import { Request, Response } from 'express';
import { roleGuard, selfOrRoleGuard } from '../../../../src/presentation/middlewares/role.middleware.js';
import { ROLES } from '../../../../src/domain/constants/roles.constant.js';

function makeRes(): jest.Mocked<Response> {
  const res = {} as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(user?: { id: number; roleId: number | null }, params: Record<string, string> = {}): Request {
  return { user: user && { ...user, email: 'u@example.com' }, params } as unknown as Request;
}

describe('roleGuard', () => {
  it('calls next for an allowed role', () => {
    const next = jest.fn();

    roleGuard(ROLES.TEACHER, ROLES.ADMIN)(makeReq({ id: 1, roleId: ROLES.TEACHER }), makeRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('responds 401 without an authenticated user', () => {
    const res = makeRes();
    const next = jest.fn();

    roleGuard(ROLES.ADMIN)(makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 403 when the user has no role', () => {
    const res = makeRes();

    roleGuard(ROLES.ADMIN)(makeReq({ id: 1, roleId: null }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('responds 403 for a role outside the allowed list', () => {
    const res = makeRes();
    const next = jest.fn();

    roleGuard(ROLES.ADMIN)(makeReq({ id: 1, roleId: ROLES.STUDENT }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('selfOrRoleGuard', () => {
  it('allows users acting on their own id', () => {
    const next = jest.fn();

    selfOrRoleGuard(ROLES.ADMIN)(makeReq({ id: 5, roleId: ROLES.STUDENT }, { id: '5' }), makeRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects other users without an allowed role', () => {
    const res = makeRes();

    selfOrRoleGuard(ROLES.ADMIN)(makeReq({ id: 5, roleId: ROLES.STUDENT }, { id: '6' }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
