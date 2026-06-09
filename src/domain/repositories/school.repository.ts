import { SchoolEntity } from "../entities/school.entity.js";
import { PaginationDto } from "../dtos/shared/pagination.dto.js";
import { SchoolListFilters } from "../interfaces/school/index.js";
import { PaginatedResult } from "../interfaces/shared/paginated-result.interface.js";

export abstract class SchoolRepository {
  abstract findById(id: number): Promise<SchoolEntity | null>;

  abstract findAll(
    pagination: PaginationDto,
    filters?: SchoolListFilters,
  ): Promise<PaginatedResult<SchoolEntity>>;
}
