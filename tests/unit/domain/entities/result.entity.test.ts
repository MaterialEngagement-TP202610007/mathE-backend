import { ResultEntity } from '../../../../src/domain/entities/result.entity.js';

const base = {
  id: 10,
  questionnaireId: 20,
  studentId: 30,
  predominantStyle: 'Visual',
  createdAt: new Date('2026-09-01T10:00:00.000Z'),
  updatedAt: new Date('2026-09-02T10:00:00.000Z'),
};

describe('ResultEntity label correction (HU-44)', () => {
  it('carries the corrected label, when and by whom (from the correctingTeacher relation)', () => {
    const entity = ResultEntity.fromObject({
      ...base,
      correctedVakLabel: 'Auditory',
      correctedAt: '2026-10-10T12:00:00.000Z',
      correctingTeacherId: 7,
      correctingTeacher: { id: 7, name: 'Profe Ana', email: 'secret@example.com', password: 'hash' },
    });

    expect(entity.correctedVakLabel).toBe('Auditory');
    expect(entity.correctedAt).toEqual(new Date('2026-10-10T12:00:00.000Z'));
    expect(entity.correctedBy).toEqual({ id: 7, name: 'Profe Ana' });
  });

  it('defaults every correction field to null for an uncorrected result', () => {
    const entity = ResultEntity.fromObject(base);

    expect(entity.correctedVakLabel).toBeNull();
    expect(entity.correctedAt).toBeNull();
    expect(entity.correctedBy).toBeNull();
  });

  it('keeps the corrector id when the relation was not loaded', () => {
    const entity = ResultEntity.fromObject({ ...base, correctedVakLabel: 'Visual', correctingTeacherId: 7 });

    expect(entity.correctedBy).toEqual({ id: 7, name: null });
  });

  it('serializes the correction fields in JSON', () => {
    const json = JSON.parse(JSON.stringify(ResultEntity.fromObject({
      ...base,
      correctedVakLabel: 'Kinesthetic',
      correctedAt: new Date('2026-10-10T12:00:00.000Z'),
      correctingTeacher: { id: 7, name: 'Profe Ana' },
    })));

    expect(json).toMatchObject({
      correctedVakLabel: 'Kinesthetic',
      correctedAt: '2026-10-10T12:00:00.000Z',
      correctedBy: { id: 7, name: 'Profe Ana' },
    });
  });
});
