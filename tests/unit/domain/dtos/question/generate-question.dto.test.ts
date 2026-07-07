import { GenerateQuestionDto } from '../../../../../src/domain/dtos/question/generate-question.dto.js';

describe('GenerateQuestionDto.create', () => {
  it('creates dto for Visual', () => {
    const [err, dto] = GenerateQuestionDto.create({ vakStyle: 'Visual' });
    expect(err).toBeUndefined();
    expect(dto!.vakStyle).toBe('Visual');
    expect(dto!.teacherId).toBeNull();
  });

  it('creates dto for Auditory', () => {
    const [err, dto] = GenerateQuestionDto.create({ vakStyle: 'Auditory' });
    expect(err).toBeUndefined();
    expect(dto!.vakStyle).toBe('Auditory');
  });

  it('creates dto for Kinesthetic', () => {
    const [err, dto] = GenerateQuestionDto.create({ vakStyle: 'Kinesthetic' });
    expect(err).toBeUndefined();
    expect(dto!.vakStyle).toBe('Kinesthetic');
  });

  it('rejects missing vakStyle', () => {
    const [err] = GenerateQuestionDto.create({});
    expect(err).toBe('Missing Vak Style');
  });

  it('rejects invalid vakStyle', () => {
    const [err] = GenerateQuestionDto.create({ vakStyle: 'Tactile' });
    expect(err).toContain('Invalid Vak Style');
  });

  it('accepts numeric teacherId', () => {
    const [err, dto] = GenerateQuestionDto.create({ vakStyle: 'Visual', teacherId: 42 });
    expect(err).toBeUndefined();
    expect(dto!.teacherId).toBe(42);
  });

  it('accepts string numeric teacherId', () => {
    const [err, dto] = GenerateQuestionDto.create({ vakStyle: 'Visual', teacherId: '10' });
    expect(err).toBeUndefined();
    expect(dto!.teacherId).toBe(10);
  });

  it('rejects non-numeric teacherId', () => {
    const [err] = GenerateQuestionDto.create({ vakStyle: 'Visual', teacherId: 'abc' });
    expect(err).toBe('Invalid Teacher Id');
  });

  it('defaults teacherId to null when not provided', () => {
    const [, dto] = GenerateQuestionDto.create({ vakStyle: 'Kinesthetic' });
    expect(dto!.teacherId).toBeNull();
  });
});
