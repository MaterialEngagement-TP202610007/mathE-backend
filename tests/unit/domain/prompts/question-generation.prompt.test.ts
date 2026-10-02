import type { ItemValidatorCatalog } from '../../../../src/domain/interfaces/item-validation/index.js';
import { buildQuestionGenerationPrompt } from '../../../../src/domain/prompts/question-generation.prompt.js';

describe('buildQuestionGenerationPrompt', () => {
  it('returns a non-empty string', () => {
    const result = buildQuestionGenerationPrompt('Visual');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes the vakStyle in output', () => {
    expect(buildQuestionGenerationPrompt('Visual')).toContain('Visual');
    expect(buildQuestionGenerationPrompt('Auditory')).toContain('Auditory');
    expect(buildQuestionGenerationPrompt('Kinesthetic')).toContain('Kinesthetic');
  });

  it('omits avoid block when no recent statements', () => {
    const result = buildQuestionGenerationPrompt('Visual', []);
    expect(result).not.toContain('Evita generar');
  });

  it('omits avoid block when recentStatements not provided', () => {
    const result = buildQuestionGenerationPrompt('Visual');
    expect(result).not.toContain('Evita generar');
  });

  it('includes avoid block with statements when provided', () => {
    const statements = ['Imagina que haces un experimento', 'Supón que tienes un proyecto'];
    const result = buildQuestionGenerationPrompt('Kinesthetic', statements);
    expect(result).toContain('Evita generar');
    expect(result).toContain('"Imagina que haces un experimento"');
    expect(result).toContain('"Supón que tienes un proyecto"');
  });

  it('includes JSON format instruction with "statement" key', () => {
    const result = buildQuestionGenerationPrompt('Visual');
    expect(result).toContain('"statement"');
  });

  it('includes JSON format instruction with "options" key', () => {
    const result = buildQuestionGenerationPrompt('Visual');
    expect(result).toContain('"options"');
  });

  it('references VAK distribution for each style', () => {
    expect(buildQuestionGenerationPrompt('Visual')).toContain('Visual (V)');
    expect(buildQuestionGenerationPrompt('Auditory')).toContain('Auditiva');
    expect(buildQuestionGenerationPrompt('Kinesthetic')).toContain('Kinestésica');
  });

  it('fixes the audience to 6to de primaria and 1ro de secundaria', () => {
    const result = buildQuestionGenerationPrompt('Visual');
    expect(result).toContain('6to de primaria');
    expect(result).toContain('1ro de secundaria');
  });

  describe('statement word cap', () => {
    it('defaults to 30 words without catalog', () => {
      expect(buildQuestionGenerationPrompt('Visual')).toContain('máximo 30 palabras');
    });

    it('uses catalog maxWords when present', () => {
      const result = buildQuestionGenerationPrompt('Visual', [], { catalog: makeCatalog({ maxWords: 22 }) });
      expect(result).toContain('máximo 22 palabras');
      expect(result).not.toContain('máximo 30 palabras');
    });

    it('falls back to 30 when catalog maxWords is null', () => {
      const result = buildQuestionGenerationPrompt('Visual', [], { catalog: makeCatalog({ maxWords: null }) });
      expect(result).toContain('máximo 30 palabras');
    });
  });

  describe('option rules', () => {
    it('requires 4 similar-length first-person options without negations', () => {
      const result = buildQuestionGenerationPrompt('Visual');
      expect(result).toContain('entre 4 y 8 palabras');
      expect(result).toContain('verbo en infinitivo');
      expect(result).toContain('"no", "nunca", "tampoco"');
      expect(result).toContain('primera persona');
    });
  });

  describe('with catalog markers', () => {
    const catalog = makeCatalog({
      markers: { V: ['mapa', 'colores', 'ver'], A: ['conversar', 'escuchar'], K: ['armar', 'construir'] },
    });

    it('lists the markers of each style', () => {
      const result = buildQuestionGenerationPrompt('Visual', [], { catalog });
      expect(result).toContain('V: mapa, colores, ver');
      expect(result).toContain('A: conversar, escuchar');
      expect(result).toContain('K: armar, construir');
      expect(result).toContain('al menos una palabra');
    });

    it('caps each marker list to the first 20 entries', () => {
      const many = Array.from({ length: 30 }, (_, i) => `marca${i}`);
      const result = buildQuestionGenerationPrompt('Visual', [], {
        catalog: makeCatalog({ markers: { V: many, A: ['a1'], K: ['k1'] } }),
      });
      expect(result).toContain('marca19');
      expect(result).not.toContain('marca20');
    });

    it('bans generic verbs except those that are catalog markers', () => {
      const result = buildQuestionGenerationPrompt('Visual', [], { catalog });
      expect(result).toContain('"tocar"');
      expect(result).toContain('"hacer"');
      expect(result).not.toContain('"ver"');
    });
  });

  describe('without catalog', () => {
    it.each([undefined, null])('bans generic verbs and asks for concrete actions (%s)', (catalog) => {
      const result = buildQuestionGenerationPrompt('Visual', [], { catalog });
      expect(result).toContain('"ver"');
      expect(result).toContain('"tocar"');
      expect(result).toContain('"hacer"');
      expect(result).toContain('mirar un mapa');
      expect(result).toContain('armar');
      expect(result).not.toContain('al menos una palabra');
    });
  });

  describe('feedback block', () => {
    it('is absent without feedback', () => {
      expect(buildQuestionGenerationPrompt('Visual')).not.toContain('Tu intento anterior');
      expect(buildQuestionGenerationPrompt('Visual', [], { feedback: [] })).not.toContain('Tu intento anterior');
    });

    it('lists deduplicated messages', () => {
      const result = buildQuestionGenerationPrompt('Visual', [], { feedback: ['msg uno', 'msg dos', 'msg uno'] });
      expect(result).toContain('Tu intento anterior fue rechazado por estas razones; corrígelas:\n- msg uno\n- msg dos');
      expect(result.split('- msg uno').length - 1).toBe(1);
    });

    it('caps messages to 8', () => {
      const feedback = Array.from({ length: 12 }, (_, i) => `problema${i}`);
      const result = buildQuestionGenerationPrompt('Visual', [], { feedback });
      expect(result).toContain('problema7');
      expect(result).not.toContain('problema8');
    });
  });
});

function makeCatalog(overrides: Partial<ItemValidatorCatalog> = {}): ItemValidatorCatalog {
  return { version: 'v1', maxWords: 30, markers: { V: ['mapa'], A: ['conversar'], K: ['armar'] }, ...overrides };
}
