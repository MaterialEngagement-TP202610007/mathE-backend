import { ListUsersDto } from '../../../../../src/domain/dtos/user/list-users.dto.js';

describe('ListUsersDto search (HU-37)', () => {
  it('trims the search term', () => {
    const [error, dto] = ListUsersDto.create({ search: '  María  ' });

    expect(error).toBeUndefined();
    expect(dto!.search).toBe('María');
  });

  it('ignores an empty or blank search term', () => {
    expect(ListUsersDto.create({ search: '' })[1]!.search).toBeUndefined();
    expect(ListUsersDto.create({ search: '   ' })[1]!.search).toBeUndefined();
  });

  it('leaves search undefined when absent and keeps the other filters', () => {
    const [error, dto] = ListUsersDto.create({ isActive: 'true', academicGradeId: '3' });

    expect(error).toBeUndefined();
    expect(dto).toMatchObject({ isActive: true, academicGradeId: 3, search: undefined });
  });

  it('rejects a search term longer than 100 characters', () => {
    const [error] = ListUsersDto.create({ search: 'a'.repeat(101) });

    expect(error).toBe('search must be at most 100 characters');
  });

  it('accepts exactly 100 characters', () => {
    const [error, dto] = ListUsersDto.create({ search: 'a'.repeat(100) });

    expect(error).toBeUndefined();
    expect(dto!.search).toHaveLength(100);
  });

  it('rejects a repeated (array) search param', () => {
    const [error] = ListUsersDto.create({ search: ['ana', 'luis'] });

    expect(error).toBe('search must be a single text value');
  });
});
