import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { SchoolListFilters } from "../../interfaces/school/index.js";
import { SchoolRepository } from "../../repositories/school.repository.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { SchoolEntity } from "../../entities/school.entity.js";

export class ListSchoolsUseCase {
  constructor(private readonly schoolRepository: SchoolRepository) {}

  execute(
    pagination: PaginationDto,
    filters?: SchoolListFilters,
  ): Promise<PaginatedResult<SchoolEntity>> {
    return this.schoolRepository.findAll(pagination, filters);
  }
}
