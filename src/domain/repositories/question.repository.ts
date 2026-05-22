import { QuestionEntity } from "../entities/question.entity.js";
import {
  CreateQuestionData,
  QuestionEmbeddingVector,
} from "../interfaces/question/index.js";

export abstract class QuestionRepository {
  /**
   * Embeddings of existing questions of the same VAK style (PASO 4) — the
   * only candidates worth comparing against for redundancy.
   */
  abstract findEmbeddingsByVakStyle(
    vakStyle: string,
  ): Promise<QuestionEmbeddingVector[]>;

  /**
   * Atomic persistence (PASO 5): Question + Options + QuestionEmbedding in a
   * single transaction. Returns the question with its options loaded.
   */
  abstract createWithOptionsAndEmbedding(
    data: CreateQuestionData,
  ): Promise<QuestionEntity>;
}
