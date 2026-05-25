import { CustomError } from "../../error/custom-error.js";
import { QuestionRepository } from "../../repositories/question.repository.js";
import { AIQuestionGeneratorAdapter } from "../../adapters/ai-question-generator.adapter.js";
import { EmbeddingAdapter } from "../../adapters/embedding.adapter.js";
import { GenerateQuestionDto } from "../../dtos/question/generate-question.dto.js";
import { QuestionEntity } from "../../entities/question.entity.js";
import { GeneratedQuestion } from "../../interfaces/question/index.js";
import { VAK_VALUES } from "../../constants/vak.constant.js";

export interface GenerateQuestionConfig {
  /** Cosine similarity at/above which a statement is deemed redundant (PASO 4). */
  similarityThreshold: number;
  /** Max regeneration attempts before giving up (PASO 4). */
  maxAttempts: number;
}

export class GenerateQuestionUseCase {
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly aiGenerator: AIQuestionGeneratorAdapter,
    private readonly embeddingAdapter: EmbeddingAdapter,
    private readonly config: GenerateQuestionConfig,
  ) {}

  async execute(dto: GenerateQuestionDto): Promise<QuestionEntity> {
    // Existing embeddings of the same style — fetched once, reused per attempt (PASO 4).
    const existing = await this.questionRepository.findEmbeddingsByVakStyle(
      dto.vakStyle,
    );

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {

      const generated = await this.aiGenerator.generateQuestion(dto.vakStyle);

      if (!this.isValid(generated)) continue;

      const vector = await this.embeddingAdapter.embed(generated.statement);

      // PASO 4 — compare against same-style embeddings.
      const maxSimilarity = existing.reduce(
        (max, e) => Math.max(max, this.cosineSimilarity(vector, e.vector)),
        0,
      );
      
      if (maxSimilarity >= this.config.similarityThreshold) continue;

      return this.questionRepository.createWithOptionsAndEmbedding({
        statement: generated.statement,
        vakStyle: dto.vakStyle,
        contentType: "text",
        origin: "ai_generated",
        validationStatus: "pending", //  se espera a la validación del prosooorr
        generationDate: new Date(),
        teacherId: dto.teacherId,
        options: generated.options,
        embeddingVector: vector,
        embeddingModelVersion: this.embeddingAdapter.modelVersion,
      });
    }

    throw CustomError.serviceUnavailable(
      `Could not generate a unique ${dto.vakStyle} question after ${this.config.maxAttempts} attempts`,
    );
  }

  /** PASO 2 — statement present, exactly 4 options, and V + A + K all present. */
  private isValid(q: GeneratedQuestion): boolean {
    if (!q.statement || q.statement.trim().length === 0) return false;
    if (!Array.isArray(q.options) || q.options.length !== 4) return false;
    if (q.options.some((o) => !o.text || !VAK_VALUES.includes(o.vakValue))) {
      return false;
    }
    const present = new Set(q.options.map((o) => o.vakValue));
    return VAK_VALUES.every((v) => present.has(v));
  }

  /** Cosine similarity of two equal-length vectors; 0 if either is degenerate. */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
