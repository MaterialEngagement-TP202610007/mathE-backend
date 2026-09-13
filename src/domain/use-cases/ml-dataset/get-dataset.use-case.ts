import { MLDatasetRepository } from "../../repositories/ml-dataset.repository.js";
import { MLDatasetEntity } from "../../entities/ml-dataset.entity.js";
import { MLDatasetListFilters } from "../../interfaces/ml-dataset/index.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { Requester } from "../../interfaces/shared/requester.interface.js";
import { SchoolAccessPolicy } from "../../policies/school-access.policy.js";

export class GetDatasetUseCase {
  constructor(
    private readonly mlDatasetRepository: MLDatasetRepository,
    private readonly schoolAccessPolicy: SchoolAccessPolicy,
  ) {}

  async execute(
    pagination: PaginationDto,
    filters: MLDatasetListFilters | undefined,
    requester: Requester,
  ): Promise<PaginatedResult<MLDatasetEntity>> {
    if (filters?.schoolId !== undefined) {
      await this.schoolAccessPolicy.assertCanAccessSchool(
        requester,
        filters.schoolId,
      );
    }
    return this.mlDatasetRepository.findAll(pagination, filters);
  }
}
