import { v4 as uuidv4 } from "uuid";
import { CustomError } from "../../error/custom-error.js";
import { QuestionRepository } from "../../repositories/question.repository.js";
import { AIQuestionGeneratorAdapter } from "../../adapters/ai-question-generator.adapter.js";
import { AIImageGeneratorAdapter } from "../../adapters/ai-image-generator.adapter.js";
import { ImageStorageAdapter } from "../../adapters/image-storage.adapter.js";
import { EmbeddingAdapter } from "../../adapters/embedding.adapter.js";
import { GenerateQuestionDto } from "../../dtos/question/generate-question.dto.js";
import { QuestionEntity } from "../../entities/question.entity.js";
import { GeneratedQuestion } from "../../interfaces/question/index.js";
import { VAK_VALUES } from "../../constants/vak.constant.js";
import { buildQuestionGenerationPrompt } from "../../prompts/question-generation.prompt.js";
import { buildQuestionImagePrompt } from "../../prompts/question-image.prompt.js";

export interface GenerateQuestionConfig {
  maxAttempts: number;
}

export class GenerateQuestionUseCase {
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly aiGenerator: AIQuestionGeneratorAdapter,
    private readonly embeddingAdapter: EmbeddingAdapter,
    private readonly imageGenerator: AIImageGeneratorAdapter,
    private readonly imageStorage: ImageStorageAdapter,
    private readonly config: GenerateQuestionConfig,
  ) {}

  async execute(
    dto: GenerateQuestionDto,
    recentStatements: string[] = [],
  ): Promise<QuestionEntity> {
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      const prompt = buildQuestionGenerationPrompt(dto.vakStyle, recentStatements);
      const generated = await this.aiGenerator.generateQuestion(prompt);

      if (!this.isValid(generated)) continue;

      const vector = await this.embeddingAdapter.embed(generated.statement);
      const mediaUrl = await this.generateAndUploadImage(generated.statement);

      return this.questionRepository.createWithOptionsAndEmbedding({
        statement: generated.statement,
        vakStyle: dto.vakStyle,
        contentType: "text",
        origin: "ai_generated",
        validationStatus: "pending",
        generationDate: new Date(),
        teacherId: dto.teacherId,
        options: generated.options,
        embeddingVector: vector,
        embeddingModelVersion: this.embeddingAdapter.modelVersion,
        mediaUrl,
      });
    }

    throw CustomError.serviceUnavailable(
      `Could not generate a valid ${dto.vakStyle} question after ${this.config.maxAttempts} attempts`,
    );
  }

  private async generateAndUploadImage(statement: string): Promise<string | null> {
    try {
      const prompt = buildQuestionImagePrompt(statement);
      const imageBuffer = await this.imageGenerator.generateImage(prompt);
      return await this.imageStorage.upload(
        `questions/${uuidv4()}.jpeg`,
        imageBuffer,
        "image/jpeg",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[image] generation failed:", message);
      return null;
    }
  }

  private isValid(q: GeneratedQuestion): boolean {
    if (!q.statement || q.statement.trim().length === 0) return false;
    if (!Array.isArray(q.options) || q.options.length !== 4) return false;
    if (q.options.some((o) => !o.text || !VAK_VALUES.includes(o.vakValue))) {
      return false;
    }
    const present = new Set(q.options.map((o) => o.vakValue));
    return VAK_VALUES.every((v) => present.has(v));
  }
}
