import { MLDatasetEntity } from "../entities/ml-dataset.entity.js";
import { MLDatasetListFilters } from "../interfaces/ml-dataset/index.js";
import { PaginationDto } from "../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../interfaces/shared/paginated-result.interface.js";

export abstract class MLDatasetRepository {
  abstract findAll(
    pagination: PaginationDto,
    filters?: MLDatasetListFilters,
  ): Promise<PaginatedResult<MLDatasetEntity>>;

  abstract findById(id: number): Promise<MLDatasetEntity | null>;
}
