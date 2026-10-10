import { v4 as uuidv4 } from "uuid";
import { QuestionGenerationError } from "./question-generation.error.js";
import { QuestionRepository } from "../../repositories/question.repository.js";
import { AIQuestionGeneratorAdapter } from "../../adapters/ai-question-generator.adapter.js";
import { AIImageGeneratorAdapter } from "../../adapters/ai-image-generator.adapter.js";
import { ImageStorageAdapter } from "../../adapters/image-storage.adapter.js";
import { EmbeddingAdapter } from "../../adapters/embedding.adapter.js";
import { GenerateQuestionDto } from "../../dtos/question/generate-question.dto.js";
import { QuestionEntity } from "../../entities/question.entity.js";
import { GeneratedQuestion } from "../../interfaces/question/index.js";
import { VAK_VALUES, VakStyle, VakValue } from "../../constants/vak.constant.js";
import {
  buildQuestionGenerationPrompt,
  buildQuestionRevisionPrompt,
} from "../../prompts/question-generation.prompt.js";
import { ItemValidatorAdapter } from "../../adapters/item-validator.adapter.js";
import type {
  ItemValidationBatch,
  ItemValidatorCatalog,
  ItemViolation,
  MviAttemptRecord,
  MviMode,
  MviRuleSnapshot,
  MviStatus,
  MviValidationRecord,
} from "../../interfaces/item-validation/index.js";
import { buildQuestionImagePrompt } from "../../prompts/question-image.prompt.js";

export interface GenerateQuestionConfig {
  maxAttempts: number;
  /** Base delay for exponential backoff when the AI call throws (default 1000 ms). */
  retryBaseDelayMs?: number;
  /** Injectable delay — lets tests skip real waiting. */
  sleep?: (ms: number) => Promise<void>;
  /** How MVI validation applies to generated questions (default "off"). */
  mviMode?: MviMode;
  /** Injectable clock for `mviValidatedAt` — lets tests pin the timestamp. */
  now?: () => Date;
}

/** Inputs for MVI validation, resolved once per batch by the caller. */
export interface GenerationValidationContext {
  /** Statements already stored (duplicate detection). */
  bank: string[];
  catalog: ItemValidatorCatalog | null;
}

interface MviOutcome {
  mviStatus: MviStatus;
  mviResult: MviValidationRecord | null;
  mviCatalogVersion: string | null;
  mviValidatedAt: Date | null;
}

interface RejectedAttempt {
  generated: GeneratedQuestion;
  violations: ItemViolation[];
  blockingCount: number;
  catalogVersion: string;
}

const DEFAULT_RETRY_BASE_DELAY_MS = 1000;

const VAK_VALUE_BY_STYLE: Record<VakStyle, VakValue> = {
  Visual: "V",
  Auditory: "A",
  Kinesthetic: "K",
};

const NOT_VALIDATED: Omit<MviOutcome, "mviStatus"> = {
  mviResult: null,
  mviCatalogVersion: null,
  mviValidatedAt: null,
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class GenerateQuestionUseCase {
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly aiGenerator: AIQuestionGeneratorAdapter,
    private readonly embeddingAdapter: EmbeddingAdapter,
    private readonly imageGenerator: AIImageGeneratorAdapter,
    private readonly imageStorage: ImageStorageAdapter,
    private readonly config: GenerateQuestionConfig,
    private readonly itemValidator: ItemValidatorAdapter | null = null,
  ) {}

  /**
   * @param schoolId school whose question bank receives the question (the
   *   generating teacher's school, resolved by the caller).
   * @param validation MVI inputs; ignored when MVI is off or not configured.
   */
  async execute(
    dto: GenerateQuestionDto,
    recentStatements: string[] = [],
    schoolId: number | null = null,
    validation: GenerationValidationContext = { bank: [], catalog: null },
  ): Promise<QuestionEntity> {
    const { maxAttempts } = this.config;
    const baseDelay = this.config.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    const sleep = this.config.sleep ?? defaultSleep;
    const mviMode = this.config.mviMode ?? "off";
    const validator = mviMode === "off" ? null : this.itemValidator;

    // Last attempt that reached MVI and was rejected: the next attempt revises it in place.
    let lastRejected: { generated: GeneratedQuestion; messages: string[] } | null = null;
    let best: RejectedAttempt | null = null;
    // One entry per answered MVI call, in order (the teacher-facing trace).
    const history: MviAttemptRecord[] = [];
    const rules = ruleSnapshot(validation.catalog);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const isRevision = lastRejected !== null;
      const prompt = lastRejected
        ? buildQuestionRevisionPrompt(
            dto.vakStyle,
            lastRejected.generated,
            lastRejected.messages,
            { catalog: validation.catalog },
          )
        : buildQuestionGenerationPrompt(dto.vakStyle, recentStatements, {
            catalog: validation.catalog,
          });

      let generated: GeneratedQuestion;
      try {
        generated = await this.aiGenerator.generateQuestion(prompt);
      } catch (err) {
        // Transient AI failures (429 / 5xx / timeout): back off and retry.
        if (attempt === maxAttempts) {
          if (best) break;
          throw QuestionGenerationError.aiUnavailable(err);
        }
        console.error(
          `[question] AI generation attempt ${attempt} failed:`,
          errorMessage(err),
        );
        await sleep(baseDelay * 2 ** (attempt - 1));
        continue;
      }

      if (!this.isValid(generated, dto.vakStyle)) continue;
      if (lastRejected && !sameVakValues(lastRejected.generated, generated)) continue;

      if (!validator) {
        return this.save(dto, schoolId, generated, {
          mviStatus: "skipped",
          ...NOT_VALIDATED,
        });
      }

      let batch: ItemValidationBatch;
      try {
        batch = await validator.validate(
          [
            {
              statement: generated.statement,
              vakStyle: dto.vakStyle,
              options: generated.options,
            },
          ],
          validation.bank,
        );
      } catch (err) {
        console.warn("[mvi] validation unavailable:", errorMessage(err));
        return this.save(dto, schoolId, generated, {
          mviStatus: "unavailable",
          ...NOT_VALIDATED,
        });
      }

      const result = batch.results[0];
      if (!result) {
        console.warn("[mvi] validation returned no result");
        return this.save(dto, schoolId, generated, {
          mviStatus: "unavailable",
          ...NOT_VALIDATED,
        });
      }

      history.push({
        attempt: history.length + 1,
        kind: isRevision ? "revision" : "generation",
        statement: generated.statement,
        options: generated.options,
        approved: result.approved,
        violations: result.violations,
        validatedAt: this.now().toISOString(),
      });

      if (result.approved) {
        return this.save(dto, schoolId, generated, {
          mviStatus: "passed",
          mviResult: {
            approved: true,
            violations: result.violations,
            attempts: attempt,
            history,
            ...rules,
          },
          mviCatalogVersion: batch.catalogVersion,
          mviValidatedAt: this.now(),
        });
      }

      const blockingMessages = result.violations
        .filter((v) => v.severity === "blocking")
        .map((v) => v.message);
      if (!best || blockingMessages.length < best.blockingCount) {
        best = {
          generated,
          violations: result.violations,
          blockingCount: blockingMessages.length,
          catalogVersion: batch.catalogVersion,
        };
      }
      lastRejected = { generated, messages: blockingMessages };
    }

    if (best) {
      if (mviMode === "gate") {
        throw QuestionGenerationError.mviRejected(
          `Generated ${dto.vakStyle} question did not pass MVI after ${maxAttempts} attempts`,
        );
      }
      return this.save(dto, schoolId, best.generated, {
        mviStatus: "failed",
        mviResult: {
          approved: false,
          violations: best.violations,
          attempts: maxAttempts,
          history,
          ...rules,
        },
        mviCatalogVersion: best.catalogVersion,
        mviValidatedAt: this.now(),
      });
    }

    throw QuestionGenerationError.validationFailed(
      `Could not generate a valid ${dto.vakStyle} question after ${maxAttempts} attempts`,
    );
  }

  private now(): Date {
    return (this.config.now ?? (() => new Date()))();
  }

  /** Embedding and image are produced only for the attempt that is persisted. */
  private async save(
    dto: GenerateQuestionDto,
    schoolId: number | null,
    generated: GeneratedQuestion,
    mvi: MviOutcome,
  ): Promise<QuestionEntity> {
    const vector = await this.embedOrNull(generated.statement);
    const mediaUrl = await this.generateAndUploadImage(generated.statement);

    return this.questionRepository.createWithOptionsAndEmbedding({
      statement: generated.statement,
      vakStyle: dto.vakStyle,
      contentType: "text",
      origin: "ai_generated",
      validationStatus: "pending",
      generationDate: new Date(),
      teacherId: dto.teacherId,
      schoolId,
      options: generated.options,
      embeddingVector: vector,
      embeddingModelVersion: this.embeddingAdapter.modelVersion,
      mediaUrl,
      ...mvi,
    });
  }

  /** Embeddings are auxiliary — a failure must not discard a valid question. */
  private async embedOrNull(statement: string): Promise<number[] | null> {
    try {
      return await this.embeddingAdapter.embed(statement);
    } catch (err) {
      console.error("[embedding] generation failed:", errorMessage(err));
      return null;
    }
  }

  private async generateAndUploadImage(statement: string): Promise<string | null> {
    try {
      const prompt = buildQuestionImagePrompt(statement);
      const imageBuffer = await this.imageGenerator.generateImage(prompt);
      const { extension, mimeType } = detectImageType(imageBuffer);
      return await this.imageStorage.upload(
        `questions/${uuidv4()}.${extension}`,
        imageBuffer,
        mimeType,
      );
    } catch (err) {
      console.error("[image] generation failed:", errorMessage(err));
      return null;
    }
  }

  /**
   * A valid draft has 4 options distributed by VAK label (HU-20): 2 options
   * with the question's own style and 1 with each of the other two styles.
   */
  private isValid(q: GeneratedQuestion, vakStyle: VakStyle): boolean {
    if (!q.statement || q.statement.trim().length === 0) return false;
    if (!Array.isArray(q.options) || q.options.length !== 4) return false;
    if (q.options.some((o) => !o.text || !VAK_VALUES.includes(o.vakValue))) {
      return false;
    }
    const own = VAK_VALUE_BY_STYLE[vakStyle];
    return VAK_VALUES.every((v) => {
      const count = q.options.filter((o) => o.vakValue === v).length;
      return count === (v === own ? 2 : 1);
    });
  }
}

/** The catalog rules as a spreadable `rules` key; no key when the catalog is unknown. */
function ruleSnapshot(
  catalog: ItemValidatorCatalog | null,
): { rules?: MviRuleSnapshot[] } {
  return catalog ? { rules: catalog.rules.map((rule) => ({ ...rule })) } : {};
}

/** A revision must keep each option's VAK label at its original position. */
function sameVakValues(previous: GeneratedQuestion, revised: GeneratedQuestion): boolean {
  return previous.options.every((o, i) => revised.options[i]?.vakValue === o.vakValue);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

/** Detects PNG from magic bytes; anything else keeps the previous JPEG default. */
function detectImageType(data: Buffer): { extension: string; mimeType: string } {
  const isPng = PNG_SIGNATURE.every((byte, i) => data[i] === byte);
  return isPng
    ? { extension: "png", mimeType: "image/png" }
    : { extension: "jpeg", mimeType: "image/jpeg" };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
