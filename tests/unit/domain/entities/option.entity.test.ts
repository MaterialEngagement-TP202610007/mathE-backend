import { OptionEntity } from '../../../../src/domain/entities/option.entity.js';
import { CustomError } from '../../../../src/domain/error/custom-error.js';

const base = {
  id: 1,
  questionId: 1,
  text: 'Me ayuda ver un gráfico',
  vakValue: 'V',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('OptionEntity.fromObject', () => {
  it('creates entity from valid object', () => {
    const entity = OptionEntity.fromObject(base);
    expect(entity.id).toBe(1);
    expect(entity.questionId).toBe(1);
    expect(entity.text).toBe('Me ayuda ver un gráfico');
    expect(entity.vakValue).toBe('V');
    expect(entity.deletedAt).toBeNull();
  });

  it('throws on missing id', () => {
    expect(() => OptionEntity.fromObject({ ...base, id: 0 })).toThrow(CustomError);
  });

  it('throws on missing questionId', () => {
    expect(() => OptionEntity.fromObject({ ...base, questionId: 0 })).toThrow(CustomError);
  });

  it('throws on missing text', () => {
    expect(() => OptionEntity.fromObject({ ...base, text: '' })).toThrow(CustomError);
  });

  it('throws on missing vakValue', () => {
    expect(() => OptionEntity.fromObject({ ...base, vakValue: '' })).toThrow(CustomError);
  });

  it('sets deletedAt from date string', () => {
    const deleted = new Date('2024-01-01');
    const entity = OptionEntity.fromObject({ ...base, deletedAt: deleted.toISOString() });
    expect(entity.deletedAt).toBeInstanceOf(Date);
  });
});
