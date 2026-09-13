import { NextFunction, Request, Response } from 'express';
import {
  emailOrIpKey,
  userOrIpKey,
  createRateLimiter,
} from '../../../../src/presentation/middlewares/rate-limit.middleware.js';

function makeRes(): jest.Mocked<Response> {
  const res = { headersSent: false } as unknown as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.append = jest.fn().mockReturnValue(res);
  res.on = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: '203.0.113.7',
    body: {},
    headers: {},
    app: { get: () => false },
    ...overrides,
  } as unknown as Request;
}

describe('rate limit keys', () => {
  it('keys auth requests by normalized email', () => {
    expect(emailOrIpKey(makeReq({ body: { email: '  Student@Example.COM ' } }))).toBe('email:student@example.com');
  });

  it('falls back to the IP when the email is missing or not a string', () => {
    expect(emailOrIpKey(makeReq({ body: {} }))).toBe('ip:203.0.113.7');
    expect(emailOrIpKey(makeReq({ body: { email: ['a@b.c'] } }))).toBe('ip:203.0.113.7');
    expect(emailOrIpKey(makeReq({ body: undefined }))).toBe('ip:203.0.113.7');
  });

  it('keys authenticated requests by user id', () => {
    const req = makeReq({ user: { id: 42, email: 'x@y.z', roleId: 2 } } as Partial<Request>);
    expect(userOrIpKey(req)).toBe('user:42');
  });

  it('falls back to the IP without an authenticated user', () => {
    expect(userOrIpKey(makeReq())).toBe('ip:203.0.113.7');
  });
});

describe('createRateLimiter', () => {
  it('responds 429 with a JSON error body once the limit is exceeded', async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      limit: 2,
      keyGenerator: emailOrIpKey,
      message: 'Too many attempts, try again later',
    });
    const req = makeReq({ body: { email: 'a@b.com' } });

    for (let i = 0; i < 2; i++) {
      const next = jest.fn() as jest.MockedFunction<NextFunction>;
      await limiter(req, makeRes(), next);
      expect(next).toHaveBeenCalled();
    }

    const res = makeRes();
    const next = jest.fn();
    await limiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'Too many attempts, try again later' });
  });

  it('tracks different emails independently', async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      limit: 1,
      keyGenerator: emailOrIpKey,
      message: 'Too many attempts',
    });

    const first = jest.fn();
    await limiter(makeReq({ body: { email: 'one@b.com' } }), makeRes(), first);
    const second = jest.fn();
    await limiter(makeReq({ body: { email: 'two@b.com' } }), makeRes(), second);

    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });
});
