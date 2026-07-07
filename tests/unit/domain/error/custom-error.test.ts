import { CustomError } from '../../../../src/domain/error/custom-error.js';

describe('CustomError', () => {
  it('is instanceof Error', () => {
    expect(CustomError.badRequest('x')).toBeInstanceOf(Error);
  });

  it('badRequest → 400', () => {
    const err = CustomError.badRequest('bad input');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('bad input');
  });

  it('unauthorized → 401', () => {
    const err = CustomError.unauthorized('nope');
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('nope');
  });

  it('forbidden → 403', () => {
    const err = CustomError.forbidden('denied');
    expect(err.statusCode).toBe(403);
  });

  it('notFound → 404', () => {
    const err = CustomError.notFound('missing');
    expect(err.statusCode).toBe(404);
  });

  it('conflict → 409', () => {
    const err = CustomError.conflict('dupe');
    expect(err.statusCode).toBe(409);
  });

  it('internalServer → 500', () => {
    const err = CustomError.internalServer('crash');
    expect(err.statusCode).toBe(500);
  });

  it('badGateway → 502', () => {
    const err = CustomError.badGateway('upstream');
    expect(err.statusCode).toBe(502);
  });

  it('serviceUnavailable → 503', () => {
    const err = CustomError.serviceUnavailable('down');
    expect(err.statusCode).toBe(503);
  });

  it('gatewayTimeout → 504', () => {
    const err = CustomError.gatewayTimeout('timeout');
    expect(err.statusCode).toBe(504);
  });
});
