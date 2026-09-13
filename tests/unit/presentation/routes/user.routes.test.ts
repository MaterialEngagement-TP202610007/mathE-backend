jest.mock('../../../../src/config/database/index.js', () => ({ prisma: {} }));
jest.mock('../../../../src/infrastructure/adapters/jwt.adapter.impl.js', () => ({
  JwtAdapter: jest.fn().mockImplementation(() => ({ generate: jest.fn(), verify: jest.fn() })),
}));

import { Request, Response } from 'express';
import { UserRoutes } from '../../../../src/presentation/routes/user.routes.js';
import { ROLES } from '../../../../src/domain/constants/roles.constant.js';

type Handler = (req: Request, res: Response, next: jest.Mock) => unknown;
interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handler }[] } }

function routeHandlers(path: string, method: string): Handler[] {
  const stack = (UserRoutes.routes as unknown as { stack: Layer[] }).stack;
  const layer = stack.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack.map((s) => s.handle);
}

function makeRes(): jest.Mocked<Response> {
  const res = {} as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function runGuard(path: string, method: string, roleId: number) {
  const [guard] = routeHandlers(path, method);
  const req = { user: { id: 9, email: 'u@example.com', roleId }, params: { id: '1' } } as unknown as Request;
  const res = makeRes();
  const next = jest.fn();
  guard(req, res, next);
  return { res, next };
}

describe('UserRoutes guards', () => {
  describe('PATCH /:id/activate', () => {
    it('lets an admin through', () => {
      const { next } = runGuard('/:id/activate', 'patch', ROLES.ADMIN);
      expect(next).toHaveBeenCalled();
    });

    it.each([ROLES.TEACHER, ROLES.STUDENT])('rejects role %s with 403', (roleId) => {
      const { res, next } = runGuard('/:id/activate', 'patch', roleId);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('GET /teachers', () => {
    it('lets an admin through', () => {
      const { next } = runGuard('/teachers', 'get', ROLES.ADMIN);
      expect(next).toHaveBeenCalled();
    });

    it('rejects a teacher with 403', () => {
      const { res } = runGuard('/teachers', 'get', ROLES.TEACHER);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
