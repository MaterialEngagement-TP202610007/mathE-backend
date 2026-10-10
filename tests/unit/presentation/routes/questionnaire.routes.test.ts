jest.mock('../../../../src/config/database/index.js', () => ({ prisma: {} }));
jest.mock('../../../../src/config/envs.js', () => ({ envs: {} }));
// The generated client uses import.meta, which Jest cannot load.
jest.mock('../../../../src/generated/prisma/client.js', () => ({ Prisma: {} }));
jest.mock('../../../../src/infrastructure/adapters/jwt.adapter.impl.js', () => ({
  JwtAdapter: jest.fn().mockImplementation(() => ({ generate: jest.fn(), verify: jest.fn() })),
}));
jest.mock('../../../../src/infrastructure/adapters/gemini-vak-feedback.adapter.impl.js', () => ({
  GeminiVakFeedbackAdapterImpl: jest.fn(),
}));

import { Request, Response } from 'express';
import { QuestionnaireRoutes } from '../../../../src/presentation/routes/questionnaire.routes.js';
import { ROLES } from '../../../../src/domain/constants/roles.constant.js';

type Handler = (req: Request, res: Response, next: jest.Mock) => unknown;
interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handler }[] } }

function routeHandlers(path: string, method: string): Handler[] {
  const stack = (QuestionnaireRoutes.routes as unknown as { stack: Layer[] }).stack;
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

describe('QuestionnaireRoutes PUT /:id/answers (HU-29 S1)', () => {
  function runGuard(roleId: number) {
    const [guard] = routeHandlers('/:id/answers', 'put');
    const req = { user: { id: 9, email: 'u@example.com', roleId }, params: { id: '1' } } as unknown as Request;
    const res = makeRes();
    const next = jest.fn();
    guard(req, res, next);
    return { res, next };
  }

  it('lets a student through', () => {
    expect(runGuard(ROLES.STUDENT).next).toHaveBeenCalled();
  });

  it.each([ROLES.TEACHER, ROLES.ADMIN])('rejects role %s with 403', (roleId) => {
    const { res, next } = runGuard(roleId);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
