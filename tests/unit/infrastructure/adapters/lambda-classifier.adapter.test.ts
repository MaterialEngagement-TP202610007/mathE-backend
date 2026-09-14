jest.mock('../../../../src/config/envs.js', () => ({
  envs: {
    LAMBDA_URL: 'https://lambda.example.com/predict',
    LAMBDA_TIMEOUT_MS: 7000,
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
});
