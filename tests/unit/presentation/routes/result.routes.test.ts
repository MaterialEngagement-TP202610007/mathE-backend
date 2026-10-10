jest.mock('../../../../src/config/database/index.js', () => ({ prisma: {} }));
jest.mock('../../../../src/config/envs.js', () => ({ envs: {} }));
// The generated client uses import.meta, which Jest cannot load.
jest.mock('../../../../src/generated/prisma/client.js', () => ({ Prisma: {} }));
jest.mock('../../../../src/infrastructure/adapters/jwt.adapter.impl.js', () => ({
  JwtAdapter: jest.fn().mockImplementation(() => ({ generate: jest.fn(), verify: jest.fn() })),
}));

import { Request, Response } from 'express';
import { ResultRoutes } from '../../../../src/presentation/routes/result.routes.js';
import { ROLES } from '../../../../src/domain/constants/roles.constant.js';

type Handler = (req: Request, res: Response, next: jest.Mock) => unknown;
interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handler }[] } }

const stack = () => (ResultRoutes.routes as unknown as { stack: Layer[] }).stack;

describe('ResultRoutes GET /export (HU-49)', () => {
  it('is registered before GET /:id so "export" is not read as an id', () => {
    const paths = stack().filter((l) => l.route?.methods.get).map((l) => l.route!.path);

    expect(paths).toContain('/export');
    expect(paths.indexOf('/export')).toBeLessThan(paths.indexOf('/:id'));
  });

  it.each([
    [ROLES.TEACHER, true],
    [ROLES.ADMIN, true],
    [ROLES.STUDENT, false],
  ])('role %s allowed=%s', (roleId, allowed) => {
    const layer = stack().find((l) => l.route?.path === '/export' && l.route.methods.get)!;
    const [guard] = layer.route!.stack.map((s) => s.handle);
    const res = {} as jest.Mocked<Response>;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    const next = jest.fn();

    guard({ user: { id: 9, email: 'u@example.com', roleId } } as unknown as Request, res, next);

    expect(next.mock.calls.length > 0).toBe(allowed);
  });
});
