jest.mock('../../../../src/config/envs.js', () => ({
  envs: {
    LAMBDA_URL: 'https://lambda.example.com/predict',
    LAMBDA_TIMEOUT_MS: 4000,
    LAMBDA_DEADLINE_MS: 4500,
  },
}));

import { LambdaClassifierAdapterImpl } from '../../../../src/infrastructure/adapters/lambda-classifier.adapter.impl.js';
import { envs } from '../../../../src/config/envs.js';

const features = {
  visual_score: 5,
  auditory_score: 3,
  kinesthetic_score: 2,
  response_consistency: 0.25,
  avg_response_time: 4,
  total_changes: 1,
  total_backtracks: 0,
};

function lambdaBody(overrides: Record<string, unknown> = {}) {
  return {
    estilo_predominante: 'Kinestésico',
    estilo_secundario: 'Auditivo',
    confianza: { Visual: 15.5, Auditivo: 20.5, 'Kinestésico': 64 },
    confianza_predominante: 64,
    tipo_perfil: 'tendencia',
    es_perfil_mixto: false,
    clasificador_tipo: 'xgboost',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('LambdaClassifierAdapterImpl', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    (envs as { LAMBDA_URL: string }).LAMBDA_URL = 'https://lambda.example.com/predict';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps accented Spanish labels and probabilities to the domain output', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(lambdaBody()));

    const result = await new LambdaClassifierAdapterImpl().classify({ features });

    expect(result).toEqual({
      predominantStyle: 'Kinesthetic',
      secondaryStyle: 'Auditory',
      visualProbability: 15.5,
      auditoryProbability: 20.5,
      kinestheticProbability: 64,
      predominantConfidence: 64,
      profileType: 'tendency',
      isMixedProfile: false,
      classifierType: 'xgboost',
    });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('maps unaccented Kinestesico labels', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        lambdaBody({
          estilo_predominante: 'Kinestesico',
          confianza: { Visual: 10, Auditivo: 20, Kinestesico: 70 },
        }),
      ),
    );

    const result = await new LambdaClassifierAdapterImpl().classify({ features });

    expect(result.predominantStyle).toBe('Kinesthetic');
    expect(result.kinestheticProbability).toBe(70);
  });

  it('throws when the predominant style is not a known label', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(lambdaBody({ estilo_predominante: 'Olfativo' })));

    await expect(new LambdaClassifierAdapterImpl().classify({ features })).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it('throws when required fields are missing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ estilo_predominante: 'Visual' }));

    await expect(new LambdaClassifierAdapterImpl().classify({ features })).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it('throws when a probability is not a number', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(lambdaBody({ confianza: { Visual: '10', Auditivo: 20, Kinestesico: 70 } })),
    );

    await expect(new LambdaClassifierAdapterImpl().classify({ features })).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it('throws 503 when the Lambda URL is not configured', async () => {
    (envs as { LAMBDA_URL: string }).LAMBDA_URL = '';

    await expect(new LambdaClassifierAdapterImpl().classify({ features })).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws 502 when Lambda returns a non-ok status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

    await expect(new LambdaClassifierAdapterImpl().classify({ features })).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  describe('throttling retries', () => {
    let sleep: jest.Mock;

    beforeEach(() => {
      sleep = jest.fn().mockResolvedValue(undefined);
    });

    const adapter = (random = () => 0) => new LambdaClassifierAdapterImpl({ sleep, random });

    it('retries after a 503 and returns the classification when Lambda recovers', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ message: 'Service Unavailable' }, 503))
        .mockResolvedValueOnce(jsonResponse(lambdaBody()));

      const result = await adapter().classify({ features });

      expect(result.predominantStyle).toBe('Kinesthetic');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledTimes(1);
      expect(sleep).toHaveBeenCalledWith(500);
    });

    it('gives up after two retries when Lambda keeps throttling', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ message: 'Too Many Requests' }, 429));

      await expect(adapter().classify({ features })).rejects.toMatchObject({ statusCode: 429 });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1000]);
    });

    it('adds up to 250 ms of jitter so concurrent students do not retry in lockstep', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({}, 503))
        .mockResolvedValueOnce(jsonResponse(lambdaBody()));

      await adapter(() => 0.999).classify({ features });

      expect(sleep).toHaveBeenCalledWith(749);
    });

    it('does not retry errors that are not throttling', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

      await expect(adapter().classify({ features })).rejects.toMatchObject({ statusCode: 502 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('does not retry when the request timed out', async () => {
      fetchMock.mockRejectedValueOnce(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));

      await expect(adapter().classify({ features })).rejects.toMatchObject({ statusCode: 504 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });
  });

  describe('overall deadline (HU-52: simple_score fallback within 5 s)', () => {
    let clock: number;
    let sleep: jest.Mock;
    let timeoutSpy: jest.SpyInstance;

    beforeEach(() => {
      clock = 0;
      sleep = jest.fn(async (ms: number) => {
        clock += ms;
      });
      timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
    });

    afterEach(() => {
      timeoutSpy.mockRestore();
    });

    const adapter = () =>
      new LambdaClassifierAdapterImpl({ sleep, random: () => 0.999, now: () => clock });

    it('caps a per-request timeout configured above the deadline (e.g. a legacy 7000 ms)', async () => {
      const mutableEnvs = envs as { LAMBDA_TIMEOUT_MS: number };
      mutableEnvs.LAMBDA_TIMEOUT_MS = 7000;
      try {
        fetchMock.mockResolvedValueOnce(jsonResponse(lambdaBody()));

        await adapter().classify({ features });

        expect(timeoutSpy.mock.calls[0][0]).toBe(4500);
      } finally {
        mutableEnvs.LAMBDA_TIMEOUT_MS = 4000;
      }
    });

    it('caps each attempt at the remaining budget and cancels retries past the deadline', async () => {
      // Every attempt is throttled just before its own timeout fires.
      fetchMock.mockImplementation(async () => {
        const lastTimeout = timeoutSpy.mock.calls.at(-1)![0] as number;
        clock += lastTimeout - 1;
        return jsonResponse({ message: 'Service Unavailable' }, 503);
      });

      await expect(adapter().classify({ features })).rejects.toMatchObject({ statusCode: 502 });

      expect(clock).toBeLessThanOrEqual(4500);
      const timeouts = timeoutSpy.mock.calls.map(([ms]) => ms);
      expect(timeouts[0]).toBe(4000);
      for (const ms of timeouts) expect(ms).toBeLessThanOrEqual(4500);
    });

    it('still retries a fast throttle when the budget allows it', async () => {
      fetchMock
        .mockImplementationOnce(async () => {
          clock += 50;
          return jsonResponse({}, 503);
        })
        .mockResolvedValueOnce(jsonResponse(lambdaBody()));

      const result = await adapter().classify({ features });

      expect(result.predominantStyle).toBe('Kinesthetic');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      // 4500 budget - 50 ms first call - 749 ms backoff.
      expect(timeoutSpy.mock.calls[1][0]).toBe(3701);
    });

    it('does not retry when the backoff alone would overrun the deadline', async () => {
      fetchMock.mockImplementationOnce(async () => {
        clock += 3900;
        return jsonResponse({}, 429);
      });

      await expect(adapter().classify({ features })).rejects.toMatchObject({ statusCode: 429 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });
  });
});
