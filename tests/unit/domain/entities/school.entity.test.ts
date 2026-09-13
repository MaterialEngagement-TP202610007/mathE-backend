import { SchoolEntity } from '../../../../src/domain/entities/school.entity.js';
import { CustomError } from '../../../../src/domain/error/custom-error.js';

const createdAt = new Date('2026-09-01T00:00:00.000Z');
const updatedAt = new Date('2026-09-13T00:00:00.000Z');

const row = {
  id: 1593,
  institutionKey: 'LOC-337988-CLARETIANO',
  cenEdu: 'CLARETIANO',
  district: 'SAN MIGUEL',
  address: 'AVENIDA PARQUE DE LAS LEYENDAS 555',
  businessName: 'CONGREGACION',
  levels: ['Primaria', 'Secundaria'],
  codMods: ['0331041', '0336743'],
  createdAt,
  updatedAt,
};

describe('SchoolEntity.fromObject', () => {
  it('serializes exactly the merged school shape, in order', () => {
    const entity = SchoolEntity.fromObject(row);

    const json = JSON.parse(JSON.stringify(entity));
    expect(Object.keys(json)).toEqual([
      'id', 'institutionKey', 'cenEdu', 'district', 'address', 'businessName',
      'levels', 'codMods', 'createdAt', 'updatedAt',
    ]);
    expect(json).toEqual({
      ...row,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it('never exposes the removed per-service fields', () => {
    const entity = SchoolEntity.fromObject({ ...row, codMod: '0331041', level: 'Primaria' });

    expect(entity).not.toHaveProperty('codMod');
    expect(entity).not.toHaveProperty('level');
  });

  it('defaults missing arrays and strings', () => {
    const entity = SchoolEntity.fromObject({ id: 1, cenEdu: 'X' });

    expect(entity.levels).toEqual([]);
    expect(entity.codMods).toEqual([]);
    expect(entity.institutionKey).toBe('');
    expect(entity.district).toBe('');
  });

  it('requires id and name', () => {
    expect(() => SchoolEntity.fromObject({ ...row, id: undefined })).toThrow(CustomError);
    expect(() => SchoolEntity.fromObject({ ...row, cenEdu: '' })).toThrow(CustomError);
  });
});
