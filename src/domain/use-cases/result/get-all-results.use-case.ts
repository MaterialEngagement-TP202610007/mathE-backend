import { ResultRepository } from "../../repositories/result.repository.js";
import { ResultEntity } from "../../entities/result.entity.js";
import { ResultListFilters } from "../../interfaces/result/index.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";

export class GetAllResultsUseCase {
  constructor(private readonly resultRepository: ResultRepository) {}

  async execute(
    pagination: PaginationDto,
    filters?: ResultListFilters,
  ): Promise<PaginatedResult<ResultEntity>> {
    return this.resultRepository.findAll(pagination, filters);
  }
}
