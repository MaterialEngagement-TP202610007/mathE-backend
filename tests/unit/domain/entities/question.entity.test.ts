import { QuestionEntity } from '../../../../src/domain/entities/question.entity.js';
import { CustomError } from '../../../../src/domain/error/custom-error.js';

const base = {
  id: 1,
  statement: 'Imagina que tienes una exposición',
  contentType: 'text',
  vakStyle: 'Visual',
  origin: 'ai_generated',
  validationStatus: 'pending',
  generationDate: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  teacherId: null,
  mediaUrl: null,
  rejectionReason: null,
  deletedAt: null,
  options: [],
};

const validOption = {
  id: 1,
  questionId: 1,
  text: 'Me ayuda ver un esquema',
  vakValue: 'V',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('QuestionEntity.fromObject', () => {
  it('creates entity from valid object', () => {
    const entity = QuestionEntity.fromObject(base);
    expect(entity.id).toBe(1);
    expect(entity.vakStyle).toBe('Visual');
    expect(entity.statement).toBe('Imagina que tienes una exposición');
    expect(entity.options).toHaveLength(0);
  });

  it('maps options array via OptionEntity.fromObject', () => {
    const entity = QuestionEntity.fromObject({ ...base, options: [validOption] });
    expect(entity.options).toHaveLength(1);
    expect(entity.options[0].text).toBe('Me ayuda ver un esquema');
    expect(entity.options[0].vakValue).toBe('V');
  });

  it('defaults options to [] when not an array', () => {
    const entity = QuestionEntity.fromObject({ ...base, options: null });
    expect(entity.options).toEqual([]);
  });

  it('throws on missing id', () => {
    expect(() => QuestionEntity.fromObject({ ...base, id: 0 })).toThrow(CustomError);
  });

  it('throws on missing statement', () => {
    expect(() => QuestionEntity.fromObject({ ...base, statement: '' })).toThrow(CustomError);
  });

  it('throws on missing vakStyle', () => {
    expect(() => QuestionEntity.fromObject({ ...base, vakStyle: '' })).toThrow(CustomError);
  });

  it('stores mediaUrl when provided', () => {
    const entity = QuestionEntity.fromObject({ ...base, mediaUrl: 'https://cdn.example.com/img.jpg' });
    expect(entity.mediaUrl).toBe('https://cdn.example.com/img.jpg');
  });

  it('stores null mediaUrl when absent', () => {
    const entity = QuestionEntity.fromObject(base);
    expect(entity.mediaUrl).toBeNull();
  });

  it('defaults the MVI fields when absent', () => {
    const entity = QuestionEntity.fromObject(base);
    expect(entity.mviStatus).toBeNull();
    expect(entity.mviResult).toBeNull();
    expect(entity.mviCatalogVersion).toBeNull();
    expect(entity.mviValidatedAt).toBeNull();
    expect(entity.approvedOverMvi).toBe(false);
  });

  it('maps the MVI fields when present', () => {
    const validatedAt = new Date('2026-10-02T10:00:00Z');
    const mviResult = { approved: false, violations: [], attempts: 2 };

    const entity = QuestionEntity.fromObject({
      ...base,
      mviStatus: 'failed',
      mviResult,
      mviCatalogVersion: '0.2.0',
      mviValidatedAt: validatedAt.toISOString(),
      approvedOverMvi: true,
    });

    expect(entity.mviStatus).toBe('failed');
    expect(entity.mviResult).toEqual(mviResult);
    expect(entity.mviCatalogVersion).toBe('0.2.0');
    expect(entity.mviValidatedAt).toEqual(validatedAt);
    expect(entity.approvedOverMvi).toBe(true);
  });
});
