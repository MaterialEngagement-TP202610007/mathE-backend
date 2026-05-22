import { prisma } from "../database/index.js";
import { QuestionRepository } from "../../domain/repositories/question.repository.js";
import { QuestionEntity } from "../../domain/entities/question.entity.js";
import {
  CreateQuestionData,
  QuestionEmbeddingVector,
} from "../../domain/interfaces/question/index.js";

export class QuestionRepositoryImpl implements QuestionRepository {
  async findEmbeddingsByVakStyle(
    vakStyle: string,
  ): Promise<QuestionEmbeddingVector[]> {
    const rows = await prisma.questionEmbedding.findMany({
      where: { question: { vakStyle, deletedAt: null } },
      select: { questionId: true, embeddingVector: true },
    });

    return rows
      .map((row) => ({
        questionId: row.questionId,
        vector: this.parseVector(row.embeddingVector),
      }))
      .filter((row) => row.vector.length > 0);
  }

  async createWithOptionsAndEmbedding(
    data: CreateQuestionData,
  ): Promise<QuestionEntity> {
    // PASO 5 — Question + Options + QuestionEmbedding in one transaction.
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

  private parseVector(raw: string): number[] {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
