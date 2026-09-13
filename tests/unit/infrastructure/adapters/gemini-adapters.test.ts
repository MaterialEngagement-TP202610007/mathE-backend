jest.mock('../../../../src/config/envs.js', () => ({
  envs: {
    GEMINI_API_KEY: 'test-key',
    GEMINI_CHAT_MODEL: 'gemini-test-flash',
    GEMINI_EMBEDDING_MODEL: 'gemini-embedding-test',
    GEMINI_EMBEDDING_DIMENSIONS: 768,
    GEMINI_IMAGE_MODEL: 'gemini-test-image',
    GEMINI_FEEDBACK_TIMEOUT_MS: 8000,
    GEMINI_CHAT_TIMEOUT_MS: 30000,
    GEMINI_EMBEDDING_TIMEOUT_MS: 15000,
    GEMINI_IMAGE_TIMEOUT_MS: 60000,
  },
}));

import { GeminiVakFeedbackAdapterImpl } from '../../../../src/infrastructure/adapters/gemini-vak-feedback.adapter.impl.js';
import { GeminiQuestionGeneratorAdapter } from '../../../../src/infrastructure/adapters/gemini-question-generator.adapter.impl.js';
import { GeminiEmbeddingAdapter } from '../../../../src/infrastructure/adapters/gemini-embedding.adapter.impl.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function textCandidate(...texts: string[]) {
  return { candidates: [{ content: { parts: texts.map((text) => ({ text })) } }] };
}

describe('Gemini adapters', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('GeminiVakFeedbackAdapterImpl', () => {
    it('uses 0-100 probabilities as-is (rounded) in the prompt', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(textCandidate('Feedback')));

      await new GeminiVakFeedbackAdapterImpl().generateFeedback('Visual', 61.6, 28.2, 10.2);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const prompt: string = body.contents[0].parts[0].text;
      expect(prompt).toContain('Probabilidad Visual: 62%');
      expect(prompt).toContain('Probabilidad Auditiva: 28%');
      expect(prompt).toContain('Probabilidad Kinestésica: 10%');
    });

    it('sends the API key in the x-goog-api-key header, not the query string', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(textCandidate('Feedback')));

      await new GeminiVakFeedbackAdapterImpl().generateFeedback('Visual', 60, 30, 10);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-flash:generateContent',
      );
      expect(init.headers['x-goog-api-key']).toBe('test-key');
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('joins every text part of the first candidate', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(textCandidate('Primera parte. ', 'Segunda parte.')));

      const text = await new GeminiVakFeedbackAdapterImpl().generateFeedback('Visual', 60, 30, 10);

      expect(text).toBe('Primera parte. Segunda parte.');
    });

    it('throws 502 when Gemini returns a non-ok status', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500));

      await expect(
        new GeminiVakFeedbackAdapterImpl().generateFeedback('Visual', 60, 30, 10),
      ).rejects.toMatchObject({ statusCode: 502 });
    });
  });

  describe('GeminiQuestionGeneratorAdapter', () => {
    it('parses JSON split across several text parts', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(textCandidate('{"statement":"Pregunta",', '"options":[{"text":"a","vak_value":"V"}]}')),
      );

      const result = await new GeminiQuestionGeneratorAdapter().generateQuestion('prompt');

      expect(result).toEqual({ statement: 'Pregunta', options: [{ text: 'a', vakValue: 'V' }] });
      expect(fetchMock.mock.calls[0][1].headers['x-goog-api-key']).toBe('test-key');
    });

    it('throws 429 when Gemini rate limits the request', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, 429));

      await expect(
        new GeminiQuestionGeneratorAdapter().generateQuestion('prompt'),
      ).rejects.toMatchObject({ statusCode: 429 });
    });
  });

  describe('GeminiEmbeddingAdapter', () => {
    it('returns the embedding vector and authenticates with the header', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ embedding: { values: [0.1, 0.2] } }));

      const values = await new GeminiEmbeddingAdapter().embed('text');

      const [url, init] = fetchMock.mock.calls[0];
      expect(values).toEqual([0.1, 0.2]);
      expect(url).not.toContain('key=');
      expect(init.headers['x-goog-api-key']).toBe('test-key');
    });

    it('throws 502 when the body is not JSON', async () => {
      fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 200 }));

      await expect(new GeminiEmbeddingAdapter().embed('text')).rejects.toMatchObject({ statusCode: 502 });
    });
  });
});
