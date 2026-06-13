import { prisma } from "../../config/database/index.js";
import { AnswerRepository } from "../../domain/repositories/answer.repository.js";
import { AnswerEntity } from "../../domain/entities/answer.entity.js";
import {
  AnswerWithVakOption,
  CreateAnswerData,
} from "../../domain/interfaces/answer/index.js";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../domain/interfaces/shared/paginated-result.interface.js";

export class AnswerRepositoryImpl implements AnswerRepository {
  async create(data: CreateAnswerData): Promise<AnswerEntity> {
    const answer = await prisma.answer.create({
      data: {
        questionnaireId: data.questionnaireId,
        questionId: data.questionId,
        selectedOptionId: data.selectedOptionId ?? undefined,
        navigationSequence: data.navigationSequence ?? undefined,
        questionTimeSeconds: data.questionTimeSeconds ?? undefined,
        numberOfChanges: data.numberOfChanges ?? undefined,
        timesReviewed: data.timesReviewed ?? undefined,
      },
    });

    return AnswerEntity.fromObject(answer);
  }

  async createMany(data: CreateAnswerData[]): Promise<void> {
    await prisma.answer.createMany({
      data: data.map((d) => ({
        questionnaireId: d.questionnaireId,
        questionId: d.questionId,
        selectedOptionId: d.selectedOptionId ?? undefined,
        navigationSequence: d.navigationSequence ?? undefined,
        questionTimeSeconds: d.questionTimeSeconds ?? undefined,
        numberOfChanges: d.numberOfChanges ?? undefined,
        timesReviewed: d.timesReviewed ?? undefined,
      })),
    });
  }

  async findByQuestionnaire(
    questionnaireId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<AnswerEntity>> {
    const where = { questionnaireId, deletedAt: null };

    const { page, limit } = pagination;
    const [rows, total] = await Promise.all([
      prisma.answer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { navigationSequence: "asc" },
      }),
      prisma.answer.count({ where }),
    ]);

    return { items: rows.map(AnswerEntity.fromObject), total, page, limit };
  }

  async findById(
    id: number,
    questionnaireId: number,
  ): Promise<AnswerEntity | null> {
    const answer = await prisma.answer.findFirst({
      where: { id, questionnaireId, deletedAt: null },
    });

    return answer ? AnswerEntity.fromObject(answer) : null;
  }

  async findAllWithOptions(
    questionnaireId: number,
  ): Promise<AnswerWithVakOption[]> {
    const rows = await prisma.answer.findMany({
      where: { questionnaireId, deletedAt: null },
      include: { selectedOption: true },
    });

    return rows.map((row) => ({
      id: row.id,
      questionnaireId: row.questionnaireId,
      questionId: row.questionId,
      selectedOptionId: row.selectedOptionId ?? null,
      vakValue: row.selectedOption?.vakValue ?? null,
      questionTimeSeconds: row.questionTimeSeconds ?? null,
      numberOfChanges: row.numberOfChanges ?? null,
      timesReviewed: row.timesReviewed ?? null,
    }));
  }
}
