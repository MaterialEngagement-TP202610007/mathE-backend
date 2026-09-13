import { ResultRepository } from "../../repositories/result.repository.js";
import { ResultEntity } from "../../entities/result.entity.js";
import { ResultListFilters } from "../../interfaces/result/index.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { Requester } from "../../interfaces/shared/requester.interface.js";
import { SchoolAccessPolicy } from "../../policies/school-access.policy.js";

export class GetAllResultsUseCase {
  constructor(
    private readonly resultRepository: ResultRepository,
    private readonly schoolAccessPolicy: SchoolAccessPolicy,
  ) {}

  async execute(
    pagination: PaginationDto,
    filters: ResultListFilters | undefined,
    requester: Requester,
  ): Promise<PaginatedResult<ResultEntity>> {
    if (filters?.schoolId !== undefined) {
      await this.schoolAccessPolicy.assertCanAccessSchool(
        requester,
        filters.schoolId,
      );
    }
    return this.resultRepository.findAll(pagination, filters);
  }
}
