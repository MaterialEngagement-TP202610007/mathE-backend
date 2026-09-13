import { NextFunction, Request, Response } from 'express';
import { errorHandler, notFoundHandler } from '../../../../src/presentation/middlewares/error.middleware.js';
import { CustomError } from '../../../../src/domain/error/custom-error.js';

function makeReq(): Request {
  return { method: 'POST', originalUrl: '/api/questionnaires/1/complete', path: '/api/questionnaires/1/complete' } as Request;
}

function makeRes(headersSent = false): jest.Mocked<Response> {
  const res = { headersSent } as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function prismaError(code: string) {
  return Object.assign(new Error(`Prisma failure ${code}\n    at secret/stack.ts:1`), {
    name: 'PrismaClientKnownRequestError',
    code,
    clientVersion: '7.8.0',
  });
}

describe('errorHandler', () => {
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    next = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps CustomError to its status and message', () => {
    const res = makeRes();

    errorHandler(CustomError.forbidden('Nope'), makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Nope' });
  });

  it('maps malformed JSON bodies to 400', () => {
    const res = makeRes();
    const err = Object.assign(new SyntaxError('Unexpected token'), {
      type: 'entity.parse.failed', status: 400, expose: true,
    });

    errorHandler(err, makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Malformed JSON body' });
  });

  it('maps oversized bodies to 413', () => {
    const res = makeRes();
    const err = Object.assign(new Error('request entity too large'), {
      type: 'entity.too.large', status: 413, expose: true,
    });

    errorHandler(err, makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: 'Request body too large' });
  });

  it('honors other exposed 4xx http errors', () => {
    const res = makeRes();
    const err = Object.assign(new Error('unsupported charset "latin-9"'), {
      type: 'charset.unsupported', status: 415, expose: true,
    });

    errorHandler(err, makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith({ error: 'unsupported charset "latin-9"' });
  });

  it.each([
    ['P2002', 409],
    ['P2003', 400],
    ['P2025', 404],
    ['P2028', 503],
  ])('maps Prisma %s to %i without leaking details', (code, status) => {
    const res = makeRes();

    errorHandler(prismaError(code), makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(status);
    const body = res.json.mock.calls[0][0];
    expect(Object.keys(body)).toEqual(['error']);
    expect(body.error).not.toContain('Prisma');
    expect(body.error).not.toContain('stack');
  });

  it('maps unknown Prisma codes to 500', () => {
    const res = makeRes();

    errorHandler(prismaError('P2034'), makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('maps unexpected errors to a generic 500 and logs method and path', () => {
    const res = makeRes();

    errorHandler(new Error('boom'), makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect((console.error as jest.Mock).mock.calls[0][0]).toContain('POST /api/questionnaires/1/complete');
  });

  it('does not treat non-Prisma string codes as database errors', () => {
    const res = makeRes();

    errorHandler(Object.assign(new Error('socket'), { code: 'ECONNRESET' }), makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('delegates to Express when headers were already sent', () => {
    const res = makeRes(true);
    const err = new Error('late failure');

    errorHandler(err, makeReq(), res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('notFoundHandler', () => {
  it('responds 404 JSON for unknown routes', () => {
    const res = makeRes();

    notFoundHandler({ method: 'GET', path: '/api/nope' } as Request, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Route GET /api/nope not found' });
  });
});
