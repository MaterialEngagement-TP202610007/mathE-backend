import { ResultEntity } from "../entities/result.entity.js";
import {
  CorrectResultLabelData,
  ResultListFilters,
  SaveResultData,
  StudentResultFilters,
} from "../interfaces/result/index.js";
import { PaginationDto } from "../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../interfaces/shared/paginated-result.interface.js";

export abstract class ResultRepository {
  abstract saveWithNotification(data: SaveResultData): Promise<ResultEntity>;

  abstract findById(id: number): Promise<ResultEntity | null>;

  abstract findByQuestionnaire(
    questionnaireId: number,
  ): Promise<ResultEntity | null>;

  abstract findByStudent(
    studentId: number,
    pagination: PaginationDto,
    filters?: StudentResultFilters,
  ): Promise<PaginatedResult<ResultEntity>>;

  abstract findAll(
    pagination: PaginationDto,
    filters?: ResultListFilters,
  ): Promise<PaginatedResult<ResultEntity>>;

  abstract correctLabel(data: CorrectResultLabelData): Promise<ResultEntity>;
}
