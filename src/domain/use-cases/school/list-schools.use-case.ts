import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { SchoolListFilters } from "../../interfaces/school/index.js";
import { SchoolRepository } from "../../repositories/school.repository.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { SchoolEntity } from "../../entities/school.entity.js";

/** Largest page the public school search returns. */
export const MAX_SCHOOLS_PAGE_SIZE = 50;

export class ListSchoolsUseCase {
  constructor(private readonly schoolRepository: SchoolRepository) {}

  execute(
    pagination: PaginationDto,
    filters?: SchoolListFilters,
  ): Promise<PaginatedResult<SchoolEntity>> {
    const [, capped] = PaginationDto.create(
      pagination.page,
      Math.min(pagination.limit, MAX_SCHOOLS_PAGE_SIZE),
    );
    return this.schoolRepository.findAll(capped!, filters);
  }
}
