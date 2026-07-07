import { buildQuestionImagePrompt } from '../../../../src/domain/prompts/question-image.prompt.js';

describe('buildQuestionImagePrompt', () => {
  it('returns a non-empty string', () => {
    const result = buildQuestionImagePrompt('A science experiment');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('embeds the statement in the prompt', () => {
    const statement = 'Un experimento de química en clase';
    const result = buildQuestionImagePrompt(statement);
    expect(result).toContain(statement);
  });

  it('mentions illustration for educational context', () => {
    const result = buildQuestionImagePrompt('test');
    expect(result.toLowerCase()).toContain('illustration');
  });

  it('mentions child-friendly style', () => {
    const result = buildQuestionImagePrompt('test');
    expect(result.toLowerCase()).toContain('child-friendly');
  });

  it('quotes the statement inside the prompt', () => {
    const result = buildQuestionImagePrompt('my statement');
    expect(result).toContain('"my statement"');
  });
});
