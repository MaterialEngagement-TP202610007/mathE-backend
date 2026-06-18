import { prisma } from "../../config/database/index.js";
import { QuestionnaireRepository } from "../../domain/repositories/questionnaire.repository.js";
import { QuestionnaireEntity } from "../../domain/entities/questionnaire.entity.js";
import {
  CompleteWithAnswersAndDatasetParams,
  CompleteWithAnswersAndDatasetResult,
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
          options: existing.options.map((o) => ({
            id: o.id,
            text: o.text,
            vakValue: o.vakValue,
          })),
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
            options: q.options.map((o) => ({
              id: o.id,
              text: o.text,
              vakValue: o.vakValue,
            })),
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

    return questionnaire ? QuestionnaireEntity.fromObject(questionnaire) : null;
  }

  async findInProgressByStudent(
    studentId: number,
  ): Promise<QuestionnaireEntity | null> {
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { studentId, status: "in_progress", deletedAt: null },
    });

    return questionnaire ? QuestionnaireEntity.fromObject(questionnaire) : null;
  }

  async findActiveWithQuestions(
    studentId: number,
  ): Promise<CreateQuestionnaireResult | null> {
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { studentId, status: "in_progress", deletedAt: null },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: {
            question: {
              include: { options: { where: { deletedAt: null } } },
            },
          },
        },
      },
    });

    if (!questionnaire) return null;

    return {
      id: questionnaire.id,
      studentId: questionnaire.studentId,
      status: questionnaire.status,
      startTime: questionnaire.startTime,
      usedFallback: questionnaire.usedFallback,
      createdAt: questionnaire.createdAt,
      updatedAt: questionnaire.updatedAt,
      questions: questionnaire.questions.map((qq) => ({
        order: qq.order,
        questionId: qq.question.id,
        statement: qq.question.statement,
        contentType: qq.question.contentType,
        mediaUrl: qq.question.mediaUrl,
        options: qq.question.options.map((o) => ({
          id: o.id,
          text: o.text,
          vakValue: o.vakValue,
        })),
      })),
    };
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

  async completeWithAnswersAndDataset(
    params: CompleteWithAnswersAndDatasetParams,
  ): Promise<CompleteWithAnswersAndDatasetResult> {
    return prisma.$transaction(async (tx) => {
      // 1. Save all 10 answers
      await tx.answer.createMany({
        data: params.answers.map((a) => ({
          questionnaireId: params.questionnaireId,
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId ?? undefined,
          navigationSequence: a.navigationSequence,
          questionTimeSeconds: a.questionTimeSeconds,
          numberOfChanges: a.numberOfChanges,
          timesReviewed: a.timesReviewed,
        })),
      });

      // 2. Look up VAK values for selected options
      const selectedOptionIds = params.answers
        .map((a) => a.selectedOptionId)
        .filter((id): id is number => id !== null);

      const options = await tx.option.findMany({
        where: { id: { in: selectedOptionIds } },
        select: { id: true, vakValue: true },
      });

      const vakValueMap = new Map(options.map((o) => [o.id, o.vakValue]));

      // 3. Calculate ML features
      let visualScore = 0;
      let auditoryScore = 0;
      let kinestheticScore = 0;
      let totalQuestionTime = 0;
      let totalChanges = 0;
      let totalReviews = 0;

      for (const a of params.answers) {
        const vak = a.selectedOptionId
          ? vakValueMap.get(a.selectedOptionId)
          : null;
        if (vak === "V") visualScore++;
        else if (vak === "A") auditoryScore++;
        else if (vak === "K") kinestheticScore++;
        totalQuestionTime += a.questionTimeSeconds;
        totalChanges += a.numberOfChanges;
        totalReviews += a.timesReviewed;
      }

      const count = params.answers.length;
      const avgQuestionTime = count > 0 ? totalQuestionTime / count : 0;
      const maxScore = Math.max(visualScore, auditoryScore, kinestheticScore);
      const observed = maxScore / count;
      const responseConsistency = Math.max(0, (observed - 1 / 3) / (1 - 1 / 3));

      let vakLabel: string;
      if (visualScore >= auditoryScore && visualScore >= kinestheticScore)
        vakLabel = "Visual";
      else if (auditoryScore >= kinestheticScore) vakLabel = "Auditory";
      else vakLabel = "Kinesthetic";

      // 4. Create MLDataset row
      await tx.mLDataset.create({
        data: {
          questionnaireId: params.questionnaireId,
          studentId: params.studentId,
          visualScore,
          auditoryScore,
          kinestheticScore,
          responseConsistency,
          avgQuestionTime,
          totalChanges,
          totalReviews,
          completionPercentage: params.completionPercentage,
          vakLabel,
          labelSource: "simple_score",
          includedInTraining: false,
        },
      });

      // 5. Mark questionnaire as completed
      await tx.questionnaire.update({
        where: { id: params.questionnaireId },
        data: {
          status: "completed",
          endTime: new Date(),
          completionPercentage: params.completionPercentage,
        },
      });

      return {
        visualScore,
        auditoryScore,
        kinestheticScore,
        responseConsistency,
        avgQuestionTime,
        totalChanges,
        totalReviews,
        vakLabel,
      };
    });
  }

  async abandon(id: number): Promise<QuestionnaireEntity> {
    const questionnaire = await prisma.questionnaire.update({
      where: { id },
      data: { status: "abandoned", endTime: new Date() },
    });

    return QuestionnaireEntity.fromObject(questionnaire);
  }
}
