jest.mock('../../../../src/config/envs.js', () => ({
  envs: {
    MVI_URL: 'http://mvi.example.com',
    MVI_TOKEN: 'secret-token',
    MVI_TIMEOUT_MS: 15000,
    MVI_WAKEUP_TIMEOUT_MS: 60000,
    MVI_NIVEL: 6,
  },
}));

import { MviItemValidatorAdapterImpl } from '../../../../src/infrastructure/adapters/mvi-item-validator.adapter.impl.js';
import { envs } from '../../../../src/config/envs.js';
import { ItemToValidate } from '../../../../src/domain/interfaces/item-validation/index.js';

const mutableEnvs = envs as unknown as { MVI_URL: string };

const item: ItemToValidate = {
  id: 'q1',
  statement: 'Como organizas un mapa?',
  vakStyle: 'Visual',
  options: [
    { text: 'Dibujar un esquema', vakValue: 'V' },
    { text: 'Escuchar una explicacion', vakValue: 'A' },
    { text: 'Armar una maqueta', vakValue: 'K' },
    { text: 'Observar un grafico', vakValue: 'V' },
  ],
};

function mviResponse(overrides: Record<string, unknown> = {}) {
  return {
    resultados: [{ id: 'q1', indice: 0, aprobado: true, violaciones: [] }],
    resumen: {},
    avisos: [],
    versionCatalogo: '0.2.0',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function makeAdapter(extra: Record<string, unknown> = {}) {
  const sleep = jest.fn().mockResolvedValue(undefined);
  const adapter = new MviItemValidatorAdapterImpl({
    sleep,
    random: () => 0,
    ...extra,
  });
  return { adapter, sleep };
}

describe('MviItemValidatorAdapterImpl', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    mutableEnvs.MVI_URL = 'http://mvi.example.com';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('validate', () => {
    it('posts the mapped items and bank with the bearer token', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(mviResponse()));

      await makeAdapter().adapter.validate([item], ['otra pregunta']);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://mvi.example.com/validar');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret-token',
      });
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(JSON.parse(init.body)).toEqual({
        items: [
          {
            id: 'q1',
            enunciado: 'Como organizas un mapa?',
            dimensionDeclarada: 'V',
            nivel: 6,
            opciones: [
              { texto: 'Dibujar un esquema', dimension: 'V' },
              { texto: 'Escuchar una explicacion', dimension: 'A' },
              { texto: 'Armar una maqueta', dimension: 'K' },
              { texto: 'Observar un grafico', dimension: 'V' },
            ],
          },
        ],
        banco: ['otra pregunta'],
      });
    });

    it('maps Auditory and Kinesthetic styles and omits a missing id', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          mviResponse({
            resultados: [
              { indice: 0, aprobado: true, violaciones: [] },
              { indice: 1, aprobado: true, violaciones: [] },
            ],
          }),
        ),
      );

      await makeAdapter().adapter.validate(
        [
          { ...item, id: undefined, vakStyle: 'Auditory' },
          { ...item, id: undefined, vakStyle: 'Kinesthetic' },
        ],
        [],
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.items.map((i: any) => i.dimensionDeclarada)).toEqual(['A', 'K']);
      expect('id' in body.items[0]).toBe(false);
    });

    it('maps approved results and blocking/warning violations to the domain', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          mviResponse({
            resultados: [
              {
                id: 'q1',
                indice: 0,
                aprobado: false,
                violaciones: [
                  {
                    reglaId: 'longitud-enunciado',
                    mensaje: 'Enunciado muy largo',
                    valorMedido: 40,
                    umbral: 30,
                    severidad: 'bloqueante',
                  },
                  {
                    reglaId: 'negaciones',
                    mensaje: 'Evita negaciones',
                    valorMedido: 1,
                    umbral: 0,
                    severidad: 'advertencia',
                  },
                ],
              },
            ],
          }),
        ),
      );

      const batch = await makeAdapter().adapter.validate([item], []);

      expect(batch).toEqual({
        catalogVersion: '0.2.0',
        results: [
          {
            id: 'q1',
            approved: false,
            violations: [
              {
                ruleId: 'longitud-enunciado',
                message: 'Enunciado muy largo',
                measuredValue: 40,
                threshold: 30,
                severity: 'blocking',
              },
              {
                ruleId: 'negaciones',
                message: 'Evita negaciones',
                measuredValue: 1,
                threshold: 0,
                severity: 'warning',
              },
            ],
          },
        ],
      });
    });

    it('retries a 503 and returns the successful response', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({}, 503))
        .mockResolvedValueOnce(jsonResponse(mviResponse()));
      const { adapter, sleep } = makeAdapter({ random: () => 0.5 });

      const batch = await adapter.validate([item], []);

      expect(batch.results[0].approved).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledWith(500 + 125);
    });

    it('gives up after two retries on 429', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 429));
      const { adapter, sleep } = makeAdapter();

      await expect(adapter.validate([item], [])).rejects.toMatchObject({
        statusCode: 429,
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000]);
    });

    it('does not retry a 401, logs without the token and throws 503', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { codigo: 'no_autorizado', mensaje: 'x' } }, 401),
      );

      await expect(makeAdapter().adapter.validate([item], [])).rejects.toMatchObject({
        statusCode: 503,
        message: 'MVI authentication failed',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('MVI_TOKEN'));
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('secret-token');
    });

    it('does not retry a 400 and throws 502 with the MVI error detail', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { codigo: 'solicitud_invalida', mensaje: 'falta nivel' } }, 400),
      );

      await expect(makeAdapter().adapter.validate([item], [])).rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining('solicitud_invalida'),
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('maps other non-ok statuses to 502', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 500));

      await expect(makeAdapter().adapter.validate([item], [])).rejects.toMatchObject({
        statusCode: 502,
        message: 'MVI returned status 500',
      });
    });

    it.each([
      ['a non-object body', null],
      ['a resultados length mismatch', mviResponse({ resultados: [] })],
      [
        'a non-boolean aprobado',
        mviResponse({ resultados: [{ aprobado: 'si', violaciones: [] }] }),
      ],
      [
        'an unknown severidad',
        mviResponse({
          resultados: [
            {
              aprobado: false,
              violaciones: [{ reglaId: 'r', mensaje: 'm', severidad: 'otra' }],
            },
          ],
        }),
      ],
      [
        'a missing reglaId',
        mviResponse({
          resultados: [
            {
              aprobado: false,
              violaciones: [{ mensaje: 'm', severidad: 'bloqueante' }],
            },
          ],
        }),
      ],
      ['a missing versionCatalogo', mviResponse({ versionCatalogo: undefined })],
    ])('rejects %s with 502', async (_label, body) => {
      fetchMock.mockResolvedValue(jsonResponse(body));

      await expect(makeAdapter().adapter.validate([item], [])).rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining('MVI returned an invalid response'),
      });
    });

    it('throws 503 without calling fetch when MVI_URL is not configured', async () => {
      mutableEnvs.MVI_URL = '';

      await expect(makeAdapter().adapter.validate([item], [])).rejects.toMatchObject({
        statusCode: 503,
        message: 'MVI URL not configured',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('wakeUp', () => {
    it('returns true when /salud answers estado ok', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ estado: 'ok' }));

      await expect(makeAdapter().adapter.wakeUp()).resolves.toBe(true);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://mvi.example.com/salud');
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('returns false for a non-ok status or a different estado', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ estado: 'ok' }, 500))
        .mockResolvedValueOnce(jsonResponse({ estado: 'degradado' }));

      const { adapter } = makeAdapter();
      await expect(adapter.wakeUp()).resolves.toBe(false);
      await expect(adapter.wakeUp()).resolves.toBe(false);
    });

    it('never throws on network failure, malformed body or missing URL', async () => {
      const { adapter } = makeAdapter();
      fetchMock.mockRejectedValueOnce(new Error('boom'));
      await expect(adapter.wakeUp()).resolves.toBe(false);

      fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));
      await expect(adapter.wakeUp()).resolves.toBe(false);

      mutableEnvs.MVI_URL = '';
      fetchMock.mockClear();
      await expect(adapter.wakeUp()).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('getCatalog', () => {
    const rules = {
      version: '0.2.0',
      opcionesPorItem: 4,
      marcadores: {
        V: ['dibujar', 'observar'],
        A: { verbos: ['escuchar', 'repetir'], frases: { extra: ['decir', 'escuchar'] } },
        kinestesico: ['armar'],
      },
      niveles: [
        { nivel: 5, maxPalabras: 25 },
        { nivel: 6, maxPalabras: 30 },
      ],
      reglas: [{ id: 'longitud-enunciado', umbral: 'por nivel' }],
      banco: [],
    };

    it('parses version, markers per dimension and max words for the level', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(rules));

      const catalog = await makeAdapter().adapter.getCatalog();

      expect(catalog).toEqual({
        version: '0.2.0',
        maxWords: 30,
        markers: {
          V: ['dibujar', 'observar'],
          A: ['escuchar', 'repetir', 'decir'],
          K: ['armar'],
        },
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://mvi.example.com/reglas');
      expect(init.headers.Authorization).toBe('Bearer secret-token');
    });

    it('returns empty markers when absent and falls back to the rule threshold', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          version: '0.3.0',
          marcadores: { V: ['ver'] },
          niveles: [{ nivel: 1, maxPalabras: 10 }],
          reglas: [{ id: 'longitud-enunciado', umbral: 28 }],
        }),
      );

      const catalog = await makeAdapter().adapter.getCatalog();

      expect(catalog).toEqual({
        version: '0.3.0',
        maxWords: 28,
        markers: { V: ['ver'], A: [], K: [] },
      });
    });

    it('sets maxWords to null when nothing numeric is found', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ version: '0.3.0', marcadores: {}, niveles: [], reglas: [] }),
      );

      const catalog = await makeAdapter().adapter.getCatalog();

      expect(catalog?.maxWords).toBeNull();
    });

    it('caches a successful catalog for one hour', async () => {
      fetchMock.mockImplementation(async () => jsonResponse(rules));
      let now = 1_000_000;
      const { adapter } = makeAdapter({ now: () => now });

      await adapter.getCatalog();
      now += 59 * 60 * 1000;
      await adapter.getCatalog();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      now += 2 * 60 * 1000;
      await adapter.getCatalog();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns null without logging the token on failure and does not cache it', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      fetchMock
        .mockResolvedValueOnce(jsonResponse({}, 401))
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(jsonResponse({ marcadores: {} }))
        .mockResolvedValueOnce(jsonResponse(rules));
      const { adapter } = makeAdapter();

      await expect(adapter.getCatalog()).resolves.toBeNull();
      await expect(adapter.getCatalog()).resolves.toBeNull();
      await expect(adapter.getCatalog()).resolves.toBeNull();
      await expect(adapter.getCatalog()).resolves.toMatchObject({ version: '0.2.0' });

      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('secret-token');
    });

    it('returns null when MVI_URL is not configured', async () => {
      mutableEnvs.MVI_URL = '';

      await expect(makeAdapter().adapter.getCatalog()).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
