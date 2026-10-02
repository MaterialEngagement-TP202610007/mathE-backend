import type { ItemValidatorCatalog } from '../../../../src/domain/interfaces/item-validation/index.js';
import { buildQuestionGenerationPrompt, buildQuestionRevisionPrompt } from '../../../../src/domain/prompts/question-generation.prompt.js';

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

  describe('with catalog vocabulary', () => {
    const vocabulary = ['mapa', 'colores', 'ver', 'conversar', 'armar', 'niño', 'escuela'];
    const functionWords = ['el', 'de', 'con'];
    const catalog = makeCatalog({
      markers: { V: ['mapa', 'dibujar'], A: ['conversar'], K: ['construir', 'cartulina'] },
      vocabulary,
      functionWords,
    });

    it('adds the vocabulary section with every word on one comma-separated line', () => {
      const result = buildQuestionGenerationPrompt('Visual', [], { catalog });
      expect(result).toContain('vocabulario permitido');
      expect(result).toContain(vocabulary.join(', '));
      expect(result).toContain('mismas tildes');
      expect(result).toContain('palabras funcionales');
      expect(result).toContain(functionWords.join(', '));
      expect(result).toContain('no inventes nombres propios');
    });

    it('includes every word of a full-size vocabulary without truncation', () => {
      const big = Array.from({ length: 1200 }, (_, i) => `palabra${i}`);
      const result = buildQuestionGenerationPrompt('Visual', [], {
        catalog: makeCatalog({ vocabulary: big }),
      });
      expect(result).toContain('palabra0,');
      expect(result).toContain('palabra1199');
      expect(result).toContain(big.join(', '));
    });

    it('omits the function words line when there are none', () => {
      const result = buildQuestionGenerationPrompt('Visual', [], {
        catalog: makeCatalog({ vocabulary, functionWords: [] }),
      });
      expect(result).toContain('vocabulario permitido');
      expect(result).not.toContain('palabras funcionales');
    });

    it('keeps only markers that belong to the vocabulary', () => {
      const result = buildQuestionGenerationPrompt('Visual', [], { catalog });
      expect(result).toContain('V: mapa\n');
      expect(result).not.toContain('dibujar');
      expect(result).toContain('A: conversar');
    });

    it('keeps the original marker list when the intersection is empty', () => {
      const result = buildQuestionGenerationPrompt('Visual', [], { catalog });
      expect(result).toContain('K: construir, cartulina');
    });

    it('states that marker words must belong to the vocabulary', () => {
      const result = buildQuestionGenerationPrompt('Visual', [], { catalog });
      expect(result).toContain('también deben pertenecer al vocabulario permitido');
    });

    it('does not add the section when the vocabulary is empty', () => {
      const result = buildQuestionGenerationPrompt('Visual', [], { catalog: makeCatalog() });
      expect(result).not.toContain('vocabulario permitido');
      expect(result).not.toContain('pertenecer al vocabulario');
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

describe('buildQuestionRevisionPrompt', () => {
  const previous = {
    statement: 'Preparas una exposición con tu grupo',
    options: [
      { text: 'dibujar un mapa con colores', vakValue: 'V' as const },
      { text: 'conversar con mis amigos', vakValue: 'A' as const },
      { text: 'armar una maqueta', vakValue: 'K' as const },
      { text: 'mirar un esquema', vakValue: 'V' as const },
    ],
  };
  const vocabulary = ['mapa', 'colores', 'ver', 'conversar', 'armar'];
  const catalog = makeCatalog({
    maxWords: 22,
    markers: { V: ['mapa'], A: ['conversar'], K: ['armar'] },
    vocabulary,
    functionWords: ['el', 'de'],
  });

  it('shows the previous attempt as JSON', () => {
    const result = buildQuestionRevisionPrompt('Visual', previous, ['palabra fuera de nivel: dibujar']);
    expect(result).toContain(
      '{"statement":"Preparas una exposición con tu grupo","options":[{"text":"dibujar un mapa con colores","vak_value":"V"}',
    );
    expect(result).toContain('{"text":"mirar un esquema","vak_value":"V"}]}');
  });

  it('lists deduplicated reasons capped to 8', () => {
    const feedback = ['razón uno', 'razón uno', ...Array.from({ length: 10 }, (_, i) => `problema${i}`)];
    const result = buildQuestionRevisionPrompt('Visual', previous, feedback);
    expect(result.split('- razón uno').length - 1).toBe(1);
    expect(result).toContain('problema6');
    expect(result).not.toContain('problema7');
  });

  it('asks to keep the same 4 options in order with the same vak values', () => {
    const result = buildQuestionRevisionPrompt('Visual', previous, ['x']);
    expect(result).toContain('mismas 4 opciones');
    expect(result).toContain('mismo orden');
    expect(result).toContain('mismo vak_value');
    expect(result).toContain('SOLO');
  });

  it('keeps the shared rules and the JSON output format', () => {
    const result = buildQuestionRevisionPrompt('Visual', previous, ['x']);
    expect(result).toContain('máximo 30 palabras');
    expect(result).toContain('entre 4 y 8 palabras');
    expect(result).toContain('"no", "nunca", "tampoco"');
    expect(result).toContain('Responde ÚNICAMENTE con este JSON');
  });

  it('is not a fresh generation prompt', () => {
    const result = buildQuestionRevisionPrompt('Visual', previous, ['x']);
    expect(result).not.toContain('semilla de variación');
    expect(result).not.toContain('COMPLETAMENTE NUEVA');
  });

  it('includes the word cap, markers and vocabulary sections when the catalog has them', () => {
    const result = buildQuestionRevisionPrompt('Visual', previous, ['x'], { catalog });
    expect(result).toContain('máximo 22 palabras');
    expect(result).toContain('V: mapa');
    expect(result).toContain(vocabulary.join(', '));
    expect(result).toContain('palabras funcionales');
    expect(result).toContain('reemplaza');
  });

  it('omits the vocabulary section without a vocabulary', () => {
    const result = buildQuestionRevisionPrompt('Visual', previous, ['x'], { catalog: makeCatalog() });
    expect(result).not.toContain('vocabulario permitido');
  });
});

function makeCatalog(overrides: Partial<ItemValidatorCatalog> = {}): ItemValidatorCatalog {
  return { version: 'v1', maxWords: 30, markers: { V: ['mapa'], A: ['conversar'], K: ['armar'] }, vocabulary: [], functionWords: [], ...overrides };
}
