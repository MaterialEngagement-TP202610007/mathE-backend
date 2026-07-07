import { PaginationDto } from '../../../../../src/domain/dtos/shared/pagination.dto.js';

describe('PaginationDto.create', () => {
  it('defaults to page=1 limit=10', () => {
    const [err, dto] = PaginationDto.create();
    expect(err).toBeUndefined();
    expect(dto!.page).toBe(1);
    expect(dto!.limit).toBe(10);
  });

  it('accepts custom page and limit', () => {
    const [err, dto] = PaginationDto.create(3, 25);
    expect(err).toBeUndefined();
    expect(dto!.page).toBe(3);
    expect(dto!.limit).toBe(25);
  });

  it('rejects page <= 0', () => {
    const [err] = PaginationDto.create(0, 10);
    expect(err).toBe('Page must be greater than 0');
  });

  it('rejects negative page', () => {
    const [err] = PaginationDto.create(-1, 10);
    expect(err).toBe('Page must be greater than 0');
  });

  it('rejects limit <= 0', () => {
    const [err] = PaginationDto.create(1, 0);
    expect(err).toBe('Limit must be greater than 0');
  });

  it('rejects NaN page', () => {
    const [err] = PaginationDto.create(NaN, 10);
    expect(err).toBe('Page and Limit must be numbers');
  });

  it('rejects NaN limit', () => {
    const [err] = PaginationDto.create(1, NaN);
    expect(err).toBe('Page and Limit must be numbers');
  });
});
