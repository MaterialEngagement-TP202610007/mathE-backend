import { fetchWithTimeout, readJson } from '../../../../src/infrastructure/http/fetch-with-timeout.js';

function namedError(name: string): Error {
  return Object.assign(new Error(name), { name });
}

describe('fetchWithTimeout', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('passes an abort signal and the request init to fetch', async () => {
    const response = new Response('{}');
    fetchMock.mockResolvedValueOnce(response);

    const result = await fetchWithTimeout('https://example.com', {
      method: 'POST',
      timeoutMs: 1000,
      serviceName: 'Test service',
    });

    expect(result).toBe(response);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.com');
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init).not.toHaveProperty('timeoutMs');
    expect(init).not.toHaveProperty('serviceName');
  });

  it('throws a 504 CustomError with service name and timeout when the request times out', async () => {
    fetchMock.mockRejectedValueOnce(namedError('TimeoutError'));

    await expect(
      fetchWithTimeout('https://example.com', { timeoutMs: 1500, serviceName: 'Lambda' }),
    ).rejects.toMatchObject({ statusCode: 504, message: 'Lambda request timed out after 1500 ms' });
  });

  it('throws a 503 CustomError on network failures', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(
      fetchWithTimeout('https://example.com', { timeoutMs: 1500, serviceName: 'Gemini chat' }),
    ).rejects.toMatchObject({ statusCode: 503, message: 'Gemini chat request failed' });
  });
});

describe('readJson', () => {
  it('parses a JSON body', async () => {
    await expect(readJson(new Response('{"a":1}'), 'Lambda')).resolves.toEqual({ a: 1 });
  });

  it('throws a 502 CustomError when the body is not valid JSON', async () => {
    await expect(readJson(new Response('<html>'), 'Lambda')).rejects.toMatchObject({
      statusCode: 502,
      message: 'Lambda returned an invalid JSON body',
    });
  });

  it('throws a 504 CustomError when reading the body times out', async () => {
    const response = { json: jest.fn().mockRejectedValue(namedError('TimeoutError')) } as unknown as Response;

    await expect(readJson(response, 'Gemini image')).rejects.toMatchObject({ statusCode: 504 });
  });
});
