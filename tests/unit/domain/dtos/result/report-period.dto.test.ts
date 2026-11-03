import { ReportPeriodDto } from '../../../../../src/domain/dtos/result/report-period.dto.js';

const NOW = new Date('2026-10-10T12:00:00.000Z');

describe('ReportPeriodDto (HU-51)', () => {
  it('returns an open range when no params are sent', () => {
    const [error, dto] = ReportPeriodDto.create({}, NOW);

    expect(error).toBeUndefined();
    expect(dto!.from).toBeUndefined();
    expect(dto!.to).toBeUndefined();
  });

  it('parses ISO from/to and makes a date-only to inclusive', () => {
    const [error, dto] = ReportPeriodDto.create({ from: '2026-09-01', to: '2026-09-30' }, NOW);

    expect(error).toBeUndefined();
    expect(dto!.from!.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(dto!.to!.toISOString()).toBe('2026-09-30T23:59:59.999Z');
  });

  it('keeps a full timestamp to as sent', () => {
    const [, dto] = ReportPeriodDto.create({ to: '2026-09-30T10:00:00.000Z' }, NOW);

    expect(dto!.to!.toISOString()).toBe('2026-09-30T10:00:00.000Z');
  });

  it.each([
    ['week', '2026-10-03T12:00:00.000Z'],
    ['month', '2026-09-10T12:00:00.000Z'],
    ['quarter', '2026-07-10T12:00:00.000Z'],
    ['year', '2025-10-10T12:00:00.000Z'],
  ])('resolves period=%s relative to the clock', (period, from) => {
    const [error, dto] = ReportPeriodDto.create({ period }, NOW);

    expect(error).toBeUndefined();
    expect(dto!.from!.toISOString()).toBe(from);
    expect(dto!.to!.toISOString()).toBe(NOW.toISOString());
  });

  it('lets an explicit bound override the period bound', () => {
    const [, dto] = ReportPeriodDto.create({ period: 'month', to: '2026-10-01' }, NOW);

    expect(dto!.from!.toISOString()).toBe('2026-09-10T12:00:00.000Z');
    expect(dto!.to!.toISOString()).toBe('2026-10-01T23:59:59.999Z');
  });

  it.each([
    [{ from: 'nope' }, 'Invalid from date'],
    [{ to: '2026-13-45' }, 'Invalid to date'],
    [{ period: 'decade' }, 'period must be one of: week, month, quarter, year'],
    [{ from: '2026-10-02', to: '2026-10-01' }, 'from must be before or equal to to'],
  ])('rejects %p', (query, message) => {
    const [error, dto] = ReportPeriodDto.create(query, NOW);

    expect(error).toBe(message);
    expect(dto).toBeUndefined();
  });

  it('uses the current time when no clock is given', () => {
    const before = Date.now();
    const [, dto] = ReportPeriodDto.create({ period: 'week' });

    expect(dto!.to!.getTime()).toBeGreaterThanOrEqual(before);
  });
});
