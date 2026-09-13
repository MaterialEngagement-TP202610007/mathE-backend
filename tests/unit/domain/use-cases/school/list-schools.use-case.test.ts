import { ListSchoolsUseCase, MAX_SCHOOLS_PAGE_SIZE } from '../../../../../src/domain/use-cases/school/list-schools.use-case.js';
import { SchoolRepository } from '../../../../../src/domain/repositories/school.repository.js';
import { PaginationDto } from '../../../../../src/domain/dtos/shared/pagination.dto.js';

function makeRepo(): jest.Mocked<SchoolRepository> {
  return {
    findById: jest.fn(),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 }),
  } as unknown as jest.Mocked<SchoolRepository>;
}

describe('ListSchoolsUseCase', () => {
  it('caps the page size at 50', async () => {
    const repo = makeRepo();
    const [, pagination] = PaginationDto.create(2, 500);

    await new ListSchoolsUseCase(repo).execute(pagination!, { search: 'claretiano' });

    const [passed, filters] = repo.findAll.mock.calls[0];
    expect(MAX_SCHOOLS_PAGE_SIZE).toBe(50);
    expect(passed.limit).toBe(50);
    expect(passed.page).toBe(2);
    expect(filters).toEqual({ search: 'claretiano' });
  });

  it('keeps smaller page sizes untouched', async () => {
    const repo = makeRepo();
    const [, pagination] = PaginationDto.create(1, 20);

    await new ListSchoolsUseCase(repo).execute(pagination!);

    expect(repo.findAll.mock.calls[0][0].limit).toBe(20);
  });
});
