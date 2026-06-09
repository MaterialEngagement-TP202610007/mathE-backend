import { prisma } from "../../config/database/index.js";
import { QuestionnaireRepository } from "../../domain/repositories/questionnaire.repository.js";
import { QuestionnaireEntity } from "../../domain/entities/questionnaire.entity.js";
import {
  CompleteQuestionnaireData,
  CreateQuestionnaireResult,
  PublicQuestionView,
  QuestionnaireCreationParams,
} from "../../domain/interfaces/questionnaire/index.js";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { PaginatedResult } from "../../domain/interfaces/shared/paginated-result.interface.js";

export class QuestionnaireRepositoryImpl implements QuestionnaireRepository {
  async createWithQuestions(
    params: QuestionnaireCreationParams,
  ): Promise<CreateQuestionnaireResult> {
    return prisma.$transaction(async (tx) => {
      // 1. Persist fallback questions (create or reuse existing by statement).
      const fallbackViews: Array<PublicQuestionView> = [];

      for (const fbq of params.fallbackToCreate) {
        let existing = await tx.question.findFirst({
          where: { statement: fbq.statement, origin: "fallback_bank" },
          include: { options: { where: { deletedAt: null } } },
        });

        if (!existing) {
          existing = await tx.question.create({
            data: {
              statement: fbq.statement,
              contentType: fbq.contentType,
              vakStyle: fbq.vakStyle,
              origin: "fallback_bank",
              validationStatus: "approved",
              generationDate: new Date(),
              options: {
                create: fbq.options.map((o) => ({
                  text: o.text,
                  vakValue: o.vakValue,
                })),
              },
            },
            include: { options: true },
          });
        }

        fallbackViews.push({
          order: fbq.order,
          questionId: existing.id,
          statement: existing.statement,
          contentType: existing.contentType,
          mediaUrl: existing.mediaUrl,
          options: existing.options.map((o) => ({ id: o.id, text: o.text })),
        });
      }

      // 2. Fetch DB question details (strip sensitive fields).
      const dbViews: Array<PublicQuestionView> = await Promise.all(
        params.assignedQuestions.map(async ({ questionId, order }) => {
          const q = await tx.question.findFirstOrThrow({
            where: { id: questionId, deletedAt: null },
            include: { options: { where: { deletedAt: null } } },
          });
          return {
            order,
            questionId: q.id,
            statement: q.statement,
            contentType: q.contentType,
            mediaUrl: q.mediaUrl,
            options: q.options.map((o) => ({ id: o.id, text: o.text })),
          };
        }),
      );

      // 3. Create the questionnaire record.
      const questionnaire = await tx.questionnaire.create({
        data: {
          studentId: params.studentId,
          status: "in_progress",
          startTime: new Date(),
          usedFallback: params.usedFallback,
        },
      });

      // 4. Create junction records for all 10 questions.
      const allViews = [...dbViews, ...fallbackViews];
      await tx.questionnaireQuestion.createMany({
        data: allViews.map((v) => ({
          questionnaireId: questionnaire.id,
          questionId: v.questionId,
          order: v.order,
        })),
      });

      // 5. Return questionnaire + questions sorted by order.
      const sortedQuestions = allViews.sort((a, b) => a.order - b.order);

      return {
        id: questionnaire.id,
        studentId: questionnaire.studentId,
        status: questionnaire.status,
        startTime: questionnaire.startTime,
        usedFallback: questionnaire.usedFallback,
        createdAt: questionnaire.createdAt,
        updatedAt: questionnaire.updatedAt,
        questions: sortedQuestions,
      };
    });
  }

  async findById(id: number): Promise<QuestionnaireEntity | null> {
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { id, deletedAt: null },
    });

    return questionnaire
      ? QuestionnaireEntity.fromObject(questionnaire)
      : null;
  }

  async findByStudent(
    studentId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<QuestionnaireEntity>> {
    const where = { studentId, deletedAt: null };

    const { page, limit } = pagination;
    const [rows, total] = await Promise.all([
      prisma.questionnaire.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.questionnaire.count({ where }),
    ]);

    return {
      items: rows.map(QuestionnaireEntity.fromObject),
      total,
      page,
      limit,
    };
  }

  async complete(
    id: number,
    data: CompleteQuestionnaireData,
  ): Promise<QuestionnaireEntity> {
    const questionnaire = await prisma.questionnaire.update({
      where: { id },
      data: {
        status: "completed",
        endTime: new Date(),
        totalTimeSeconds: data.totalTimeSeconds ?? undefined,
        completionPercentage: data.completionPercentage ?? undefined,
      },
    });

    return QuestionnaireEntity.fromObject(questionnaire);
  }

  async abandon(id: number): Promise<QuestionnaireEntity> {
    const questionnaire = await prisma.questionnaire.update({
      where: { id },
      data: { status: "abandoned", endTime: new Date() },
    });

    return QuestionnaireEntity.fromObject(questionnaire);
  }
}
