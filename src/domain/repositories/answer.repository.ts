import { AnswerEntity } from "../entities/answer.entity.js";
import {
  AnswerWithVakOption,
  CreateAnswerData,
} from "../interfaces/answer/index.js";
import { PaginationDto } from "../dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../interfaces/shared/paginated-result.interface.js";

export abstract class AnswerRepository {
  abstract create(data: CreateAnswerData): Promise<AnswerEntity>;

  abstract createMany(data: CreateAnswerData[]): Promise<void>;

  abstract findByQuestionnaire(
    questionnaireId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<AnswerEntity>>;

  abstract findById(
    id: number,
    questionnaireId: number,
  ): Promise<AnswerEntity | null>;

  abstract findAllWithOptions(
    questionnaireId: number,
  ): Promise<AnswerWithVakOption[]>;
}
