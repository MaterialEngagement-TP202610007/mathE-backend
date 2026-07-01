import { prisma } from "../../config/database/index.js";
import {
  QuestionRepository,
  ApprovedQuestionSlim,
  QuestionFilters,
} from "../../domain/repositories/question.repository.js";
import { QuestionEntity } from "../../domain/entities/question.entity.js";
import { CreateQuestionData } from "../../domain/interfaces/question/index.js";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../domain/interfaces/shared/paginated-result.interface.js";

export class QuestionRepositoryImpl implements QuestionRepository {
  async findRecentStatementsByVakStyle(
    vakStyle: string,
    limit: number,
  ): Promise<string[]> {
    const rows = await prisma.question.findMany({
      where: { vakStyle, deletedAt: null },
      orderBy: { generationDate: "desc" },
      take: limit,
      select: { statement: true },
    });
    return rows.map((r) => r.statement);
  }

  async createWithOptionsAndEmbedding(
    data: CreateQuestionData,
  ): Promise<QuestionEntity> {
    const question = await prisma.$transaction(async (tx) => {
      const created = await tx.question.create({
        data: {
          statement: data.statement,
          contentType: data.contentType,
          vakStyle: data.vakStyle,
          origin: data.origin,
          validationStatus: data.validationStatus,
          generationDate: data.generationDate,
          teacherId: data.teacherId,
          mediaUrl: data.mediaUrl ?? null,
          options: {
            create: data.options.map((opt) => ({
              text: opt.text,
              vakValue: opt.vakValue,
            })),
          },
          embedding: {
            create: {
              embeddingVector: JSON.stringify(data.embeddingVector),
              modelVersion: data.embeddingModelVersion,
            },
          },
        },
        include: { options: true },
      });

      return created;
    });

    return QuestionEntity.fromObject(question);
  }

  async findApprovedByStyle(
    vakStyle: string,
    limit: number,
  ): Promise<ApprovedQuestionSlim[]> {
    // Fetch up to 3× the needed amount then shuffle — gives random selection
    // without a DB-specific random order clause.
    const rows = await prisma.question.findMany({
      where: { vakStyle, validationStatus: "approved", deletedAt: null },
      take: limit * 3,
      include: { options: { where: { deletedAt: null } } },
      orderBy: { id: "asc" },
    });

    const shuffled = this.shuffle(rows);
    return shuffled.slice(0, limit).map((q) => ({
      id: q.id,
      statement: q.statement,
      contentType: q.contentType,
      mediaUrl: q.mediaUrl,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    }));
  }

  async findByTeacher(
    teacherId: number,
    pagination: PaginationDto,
    validationStatus?: string,
    filters?: QuestionFilters,
  ): Promise<PaginatedResult<QuestionEntity>> {
    const where = {
      teacherId,
      deletedAt: null,
      ...(validationStatus ? { validationStatus } : {}),
      ...(filters?.vakStyle ? { vakStyle: filters.vakStyle } : {}),
      ...(filters?.fromDate || filters?.toDate
        ? {
            generationDate: {
              ...(filters.fromDate ? { gte: filters.fromDate } : {}),
              ...(filters.toDate ? { lte: filters.toDate } : {}),
            },
          }
        : {}),
    };

    const { page, limit } = pagination;
    const [rows, total] = await Promise.all([
      prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { options: true },
        orderBy: { generationDate: "desc" },
      }),
      prisma.question.count({ where }),
    ]);

    return { items: rows.map(QuestionEntity.fromObject), total, page, limit };
  }

  async findValidatedHistory(
    teacherId: number,
    pagination: PaginationDto,
    filters?: QuestionFilters,
  ): Promise<PaginatedResult<QuestionEntity>> {
    const where = {
      teacherId,
      deletedAt: null,
      validationStatus: { in: ["approved", "rejected"] },
      ...(filters?.vakStyle ? { vakStyle: filters.vakStyle } : {}),
      ...(filters?.fromDate || filters?.toDate
        ? {
            generationDate: {
              ...(filters.fromDate ? { gte: filters.fromDate } : {}),
              ...(filters.toDate ? { lte: filters.toDate } : {}),
            },
          }
        : {}),
    };

    const { page, limit } = pagination;
    const [rows, total] = await Promise.all([
      prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { options: true },
        orderBy: { generationDate: "desc" },
      }),
      prisma.question.count({ where }),
    ]);

    return { items: rows.map(QuestionEntity.fromObject), total, page, limit };
  }

  async findById(id: number): Promise<QuestionEntity | null> {
    const question = await prisma.question.findFirst({
      where: { id, deletedAt: null },
      include: { options: true },
    });

    return question ? QuestionEntity.fromObject(question) : null;
  }

  async approve(id: number): Promise<QuestionEntity> {
    const question = await prisma.question.update({
      where: { id },
      data: { validationStatus: "approved" },
      include: { options: true },
    });

    return QuestionEntity.fromObject(question);
  }

  async reject(id: number, rejectionReason: string): Promise<QuestionEntity> {
    const question = await prisma.question.update({
      where: { id },
      data: { validationStatus: "rejected", rejectionReason },
      include: { options: true },
    });

    return QuestionEntity.fromObject(question);
  }

  async softDelete(id: number): Promise<void> {
    await prisma.question.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

}
