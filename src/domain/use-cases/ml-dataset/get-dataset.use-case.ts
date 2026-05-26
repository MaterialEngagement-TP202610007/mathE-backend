import { MLDatasetRepository } from "../../repositories/ml-dataset.repository.js";
import { MLDatasetEntity } from "../../entities/ml-dataset.entity.js";
import { MLDatasetListFilters } from "../../interfaces/ml-dataset/index.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";

export class GetDatasetUseCase {
  constructor(private readonly mlDatasetRepository: MLDatasetRepository) {}

  async execute(
    pagination: PaginationDto,
    filters?: MLDatasetListFilters,
  ): Promise<PaginatedResult<MLDatasetEntity>> {
    return this.mlDatasetRepository.findAll(pagination, filters);
  }
}
