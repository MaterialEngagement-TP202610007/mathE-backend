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
});
