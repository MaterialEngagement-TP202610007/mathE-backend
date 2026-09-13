import { StudentResultsFilterDto } from '../../../../../src/domain/dtos/result/student-results-filter.dto.js';

describe('StudentResultsFilterDto.create', () => {
  it('returns an empty filter when no query params are given', () => {
    const [err, dto] = StudentResultsFilterDto.create({});
    expect(err).toBeUndefined();
    expect(dto).toEqual({
      startDate: undefined,
      endDate: undefined,
      predominantStyle: undefined,
      classifierType: undefined,
    });
  });

  it('passes predominantStyle and classifierType through', () => {
    const [, dto] = StudentResultsFilterDto.create({ predominantStyle: 'Visual', classifierType: 'xgboost' });
    expect(dto!.predominantStyle).toBe('Visual');
    expect(dto!.classifierType).toBe('xgboost');
  });

  it('ignores blank classifierType', () => {
    const [, dto] = StudentResultsFilterDto.create({ classifierType: '' });
    expect(dto!.classifierType).toBeUndefined();
  });

  it('keeps a date-only startDate at the start of that day (UTC)', () => {
    const [, dto] = StudentResultsFilterDto.create({ startDate: '2026-09-13' });
    expect(dto!.startDate!.toISOString()).toBe('2026-09-13T00:00:00.000Z');
  });

  it('extends a date-only endDate to the end of that day (UTC) so the whole day is included', () => {
    const [, dto] = StudentResultsFilterDto.create({ endDate: '2026-09-13' });
    expect(dto!.endDate!.toISOString()).toBe('2026-09-13T23:59:59.999Z');
  });

  it('keeps a full timestamp endDate unchanged', () => {
    const [, dto] = StudentResultsFilterDto.create({ endDate: '2026-09-13T10:30:00.000Z' });
    expect(dto!.endDate!.toISOString()).toBe('2026-09-13T10:30:00.000Z');
  });

  it.each([
    ['startDate', 'Invalid startDate'],
    ['endDate', 'Invalid endDate'],
  ])('rejects an unparseable %s', (key, message) => {
    const [err, dto] = StudentResultsFilterDto.create({ [key]: 'not-a-date' });
    expect(err).toBe(message);
    expect(dto).toBeUndefined();
  });
});
