import { ResultRepository } from "../../repositories/result.repository.js";
import { ResultEntity } from "../../entities/result.entity.js";
import { PaginationDto } from "../../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../interfaces/shared/paginated-result.interface.js";
import { StudentResultFilters } from "../../interfaces/result/index.js";

export class GetStudentResultsUseCase {
  constructor(private readonly resultRepository: ResultRepository) {}

  async execute(
    studentId: number,
    pagination: PaginationDto,
    filters?: StudentResultFilters,
  ): Promise<PaginatedResult<ResultEntity>> {
    return this.resultRepository.findByStudent(studentId, pagination, filters);
  }
}
