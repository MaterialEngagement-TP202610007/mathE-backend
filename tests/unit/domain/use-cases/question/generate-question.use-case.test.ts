jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

import { GenerateQuestionUseCase, GenerateQuestionConfig } from '../../../../../src/domain/use-cases/question/generate-question.use-case.js';
import { GenerateQuestionDto } from '../../../../../src/domain/dtos/question/generate-question.dto.js';
import { QuestionEntity } from '../../../../../src/domain/entities/question.entity.js';
import { QuestionRepository } from '../../../../../src/domain/repositories/question.repository.js';
import { AIQuestionGeneratorAdapter } from '../../../../../src/domain/adapters/ai-question-generator.adapter.js';
import { EmbeddingAdapter } from '../../../../../src/domain/adapters/embedding.adapter.js';
import { AIImageGeneratorAdapter } from '../../../../../src/domain/adapters/ai-image-generator.adapter.js';
import { ImageStorageAdapter } from '../../../../../src/domain/adapters/image-storage.adapter.js';
import { ItemValidatorAdapter } from '../../../../../src/domain/adapters/item-validator.adapter.js';
import type {
  ItemValidationBatch,
  ItemViolation,
  ItemValidatorCatalog,
  MviMode,
} from '../../../../../src/domain/interfaces/item-validation/index.js';

const validGenerated = {
  statement: 'Imagina que preparas una exposición en clase',
  options: [
    { text: 'usaría diapositivas con imágenes', vakValue: 'V' as const },
    { text: 'explicaría en voz alta', vakValue: 'A' as const },
    { text: 'haría una maqueta', vakValue: 'K' as const },
    { text: 'dibujaría un mapa mental', vakValue: 'V' as const },
  ],
};

function makeEntity(): QuestionEntity {
  return new QuestionEntity(
    1,
    validGenerated.statement,
    'text',
    'Visual',
    'ai_generated',
    'pending',
    new Date(),
    new Date(),
    new Date(),
    null,
    'https://cdn.example.com/img.jpeg',
    null,
    null,
    [],
  );
}

function makeRepo(): jest.Mocked<QuestionRepository> {
  return {
    createWithOptionsAndEmbedding: jest.fn(),
    findRecentStatementsByVakStyle: jest.fn(),
    findApprovedByStyle: jest.fn(),
    findByTeacher: jest.fn(),
    findById: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    softDelete: jest.fn(),
    findBankStatements: jest.fn(),
    updateMviValidation: jest.fn(),
  } as unknown as jest.Mocked<QuestionRepository>;
}

function makeAiGenerator(): jest.Mocked<AIQuestionGeneratorAdapter> {
  return { generateQuestion: jest.fn() } as jest.Mocked<AIQuestionGeneratorAdapter>;
}

function makeEmbeddingAdapter(): jest.Mocked<EmbeddingAdapter> {
  return {
    embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    modelVersion: 'gemini-embedding-001',
  } as jest.Mocked<EmbeddingAdapter>;
}

function makeImageGenerator(): jest.Mocked<AIImageGeneratorAdapter> {
  return { generateImage: jest.fn().mockResolvedValue(Buffer.from('img')) } as jest.Mocked<AIImageGeneratorAdapter>;
}

function makeImageStorage(): jest.Mocked<ImageStorageAdapter> {
  return { upload: jest.fn().mockResolvedValue('https://cdn.example.com/img.jpeg') } as jest.Mocked<ImageStorageAdapter>;
}

function makeValidator(): jest.Mocked<ItemValidatorAdapter> {
  return {
    validate: jest.fn(),
    wakeUp: jest.fn().mockResolvedValue(true),
    getCatalog: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<ItemValidatorAdapter>;
}

function blocking(message: string): ItemViolation {
  return { ruleId: 'R1', message, measuredValue: 1, threshold: 0, severity: 'blocking' };
}

function warning(message: string): ItemViolation {
  return { ruleId: 'R9', message, measuredValue: 1, threshold: 0, severity: 'warning' };
}

function batch(approved: boolean, violations: ItemViolation[] = []): ItemValidationBatch {
  return { results: [{ approved, violations }], catalogVersion: 'v1.2' };
}

const [, visualDto] = GenerateQuestionDto.create({ vakStyle: 'Visual', teacherId: 1 });

describe('GenerateQuestionUseCase', () => {
  let repo: jest.Mocked<QuestionRepository>;
  let aiGenerator: jest.Mocked<AIQuestionGeneratorAdapter>;
  let embeddingAdapter: jest.Mocked<EmbeddingAdapter>;
  let imageGenerator: jest.Mocked<AIImageGeneratorAdapter>;
  let imageStorage: jest.Mocked<ImageStorageAdapter>;
  let config: GenerateQuestionConfig;
  let useCase: GenerateQuestionUseCase;

  beforeEach(() => {
    repo = makeRepo();
    aiGenerator = makeAiGenerator();
    embeddingAdapter = makeEmbeddingAdapter();
    imageGenerator = makeImageGenerator();
    imageStorage = makeImageStorage();
    config = { maxAttempts: 3 };
    useCase = new GenerateQuestionUseCase(
      repo, aiGenerator, embeddingAdapter, imageGenerator, imageStorage, config,
    );
  });

  it('generates a question and returns entity', async () => {
    aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
    repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

    const result = await useCase.execute(visualDto!);

    expect(result).toBeInstanceOf(QuestionEntity);
    expect(repo.createWithOptionsAndEmbedding).toHaveBeenCalledTimes(1);
  });

  it('calls aiGenerator with a prompt string', async () => {
    aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
    repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

    await useCase.execute(visualDto!);

    expect(aiGenerator.generateQuestion).toHaveBeenCalledWith(expect.any(String));
  });

  it('generates embedding and stores it', async () => {
    aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
    repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

    await useCase.execute(visualDto!);

    expect(embeddingAdapter.embed).toHaveBeenCalledWith(validGenerated.statement);
    const payload = repo.createWithOptionsAndEmbedding.mock.calls[0][0];
    expect(payload.embeddingVector).toEqual([0.1, 0.2, 0.3]);
  });

  it('generates and uploads image', async () => {
    aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
    repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

    await useCase.execute(visualDto!);

    expect(imageGenerator.generateImage).toHaveBeenCalledTimes(1);
    expect(imageStorage.upload).toHaveBeenCalledTimes(1);
  });

  it('continues with mediaUrl=null when image generation fails', async () => {
    aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
    imageGenerator.generateImage.mockRejectedValueOnce(new Error('Gemini image error'));
    repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

    const result = await useCase.execute(visualDto!);

    expect(result).toBeInstanceOf(QuestionEntity);
    const payload = repo.createWithOptionsAndEmbedding.mock.calls[0][0];
    expect(payload.mediaUrl).toBeNull();
  });

  it('retries when AI returns invalid question', async () => {
    const invalid = { statement: '', options: [] };
    aiGenerator.generateQuestion
      .mockResolvedValueOnce(invalid as any)
      .mockResolvedValueOnce(validGenerated);
    repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

    await useCase.execute(visualDto!);

    expect(aiGenerator.generateQuestion).toHaveBeenCalledTimes(2);
  });

  it('throws serviceUnavailable after maxAttempts with invalid questions', async () => {
    const invalid = { statement: '', options: [] };
    aiGenerator.generateQuestion.mockResolvedValue(invalid as any);

    await expect(useCase.execute(visualDto!)).rejects.toMatchObject({ statusCode: 503 });
    expect(aiGenerator.generateQuestion).toHaveBeenCalledTimes(3);
  });

  it('saves the question without an embedding when embedding fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
    embeddingAdapter.embed.mockRejectedValueOnce(new Error('embedding down'));
    repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

    const result = await useCase.execute(visualDto!);

    expect(result).toBeInstanceOf(QuestionEntity);
    const payload = repo.createWithOptionsAndEmbedding.mock.calls[0][0];
    expect(payload.embeddingVector).toBeNull();
    expect(aiGenerator.generateQuestion).toHaveBeenCalledTimes(1);
  });

  describe('when the AI generator throws', () => {
    let sleep: jest.Mock;

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      sleep = jest.fn().mockResolvedValue(undefined);
      useCase = new GenerateQuestionUseCase(
        repo, aiGenerator, embeddingAdapter, imageGenerator, imageStorage,
        { maxAttempts: 3, retryBaseDelayMs: 1000, sleep },
      );
    });

    it('retries with exponential backoff and succeeds', async () => {
      aiGenerator.generateQuestion
        .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { statusCode: 429 }))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(validGenerated);
      repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

      const result = await useCase.execute(visualDto!);

      expect(result).toBeInstanceOf(QuestionEntity);
      expect(aiGenerator.generateQuestion).toHaveBeenCalledTimes(3);
      expect(sleep.mock.calls).toEqual([[1000], [2000]]);
    });

    it('rethrows the last error after maxAttempts without sleeping after the last attempt', async () => {
      const lastError = new Error('still failing');
      aiGenerator.generateQuestion
        .mockRejectedValueOnce(new Error('first'))
        .mockRejectedValueOnce(new Error('second'))
        .mockRejectedValueOnce(lastError);

      await expect(useCase.execute(visualDto!)).rejects.toBe(lastError);
      expect(sleep).toHaveBeenCalledTimes(2);
      expect(repo.createWithOptionsAndEmbedding).not.toHaveBeenCalled();
    });

    it('does not back off between invalid-content retries', async () => {
      aiGenerator.generateQuestion
        .mockResolvedValueOnce({ statement: '', options: [] } as any)
        .mockResolvedValueOnce(validGenerated);
      repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

      await useCase.execute(visualDto!);

      expect(sleep).not.toHaveBeenCalled();
    });
  });

  it('uploads PNG images with a .png key and image/png content type', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
    imageGenerator.generateImage.mockResolvedValueOnce(png);
    repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

    await useCase.execute(visualDto!);

    expect(imageStorage.upload).toHaveBeenCalledWith('questions/test-uuid-1234.png', png, 'image/png');
  });

  it('uploads JPEG images with a .jpeg key and image/jpeg content type', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
    imageGenerator.generateImage.mockResolvedValueOnce(jpeg);
    repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

    await useCase.execute(visualDto!);

    expect(imageStorage.upload).toHaveBeenCalledWith('questions/test-uuid-1234.jpeg', jpeg, 'image/jpeg');
  });

  it('stamps the question with the given school id', async () => {
    aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
    repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

    await useCase.execute(visualDto!, [], 4);

    const payload = repo.createWithOptionsAndEmbedding.mock.calls[0][0];
    expect(payload.schoolId).toBe(4);
    expect(payload.teacherId).toBe(1);
  });

  it('passes recentStatements to prompt builder', async () => {
    const recent = ['Pregunta A', 'Pregunta B'];
    aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
    repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

    await useCase.execute(visualDto!, recent);

    const promptArg = aiGenerator.generateQuestion.mock.calls[0][0];
    expect(promptArg).toContain('Pregunta A');
    expect(promptArg).toContain('Pregunta B');
  });

  describe('MVI validation', () => {
    const NOW = new Date('2026-10-02T10:00:00Z');
    let validator: jest.Mocked<ItemValidatorAdapter>;

    function build(mode: MviMode | undefined, withValidator = true, maxAttempts = 3) {
      return new GenerateQuestionUseCase(
        repo, aiGenerator, embeddingAdapter, imageGenerator, imageStorage,
        { maxAttempts, mviMode: mode, now: () => NOW },
        withValidator ? validator : undefined,
      );
    }

    function generated(statement: string) {
      return { ...validGenerated, statement };
    }

    beforeEach(() => {
      validator = makeValidator();
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      repo.createWithOptionsAndEmbedding.mockResolvedValue(makeEntity());
    });

    it.each([
      ['mode is off', 'off' as MviMode | undefined, true],
      ['mode is not configured', undefined, true],
      ['no validator is injected', 'advisory' as MviMode | undefined, false],
    ])('saves as skipped without calling the validator when %s', async (_label, mode, withValidator) => {
      aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);

      await build(mode, withValidator).execute(visualDto!);

      expect(validator.validate).not.toHaveBeenCalled();
      const payload = repo.createWithOptionsAndEmbedding.mock.calls[0][0];
      expect(payload.mviStatus).toBe('skipped');
      expect(payload.mviResult).toBeNull();
      expect(payload.mviCatalogVersion).toBeNull();
      expect(payload.mviValidatedAt).toBeNull();
    });

    it('saves as passed on the first approved attempt', async () => {
      aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
      const warn = warning('soft');
      validator.validate.mockResolvedValueOnce(batch(true, [warn]));

      await build('advisory').execute(visualDto!);

      const payload = repo.createWithOptionsAndEmbedding.mock.calls[0][0];
      expect(payload.mviStatus).toBe('passed');
      expect(payload.mviResult).toEqual({ approved: true, violations: [warn], attempts: 1 });
      expect(payload.mviCatalogVersion).toBe('v1.2');
      expect(payload.mviValidatedAt).toEqual(NOW);
      expect(validator.validate).toHaveBeenCalledWith(
        [{ statement: validGenerated.statement, vakStyle: 'Visual', options: validGenerated.options }],
        [],
      );
    });

    it('passes the bank and catalog through to validation and prompt', async () => {
      aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
      validator.validate.mockResolvedValueOnce(batch(true));
      const catalog: ItemValidatorCatalog = {
        version: 'v1.2', maxWords: 17, markers: { V: ['mapa'], A: ['conversar'], K: ['armar'] }, vocabulary: [], functionWords: [],
      };

      await build('advisory').execute(visualDto!, [], 4, { bank: ['existente 1', 'existente 2'], catalog });

      expect(validator.validate.mock.calls[0][1]).toEqual(['existente 1', 'existente 2']);
      expect(aiGenerator.generateQuestion.mock.calls[0][0]).toContain('máximo 17 palabras');
    });

    it('regenerates with the blocking messages as feedback and saves the passing attempt', async () => {
      aiGenerator.generateQuestion
        .mockResolvedValueOnce(generated('primero'))
        .mockResolvedValueOnce(generated('segundo'));
      validator.validate
        .mockResolvedValueOnce(batch(false, [blocking('opciones muy largas'), warning('ignorar')]))
        .mockResolvedValueOnce(batch(true));
      const sleep = jest.fn().mockResolvedValue(undefined);
      useCase = new GenerateQuestionUseCase(
        repo, aiGenerator, embeddingAdapter, imageGenerator, imageStorage,
        { maxAttempts: 3, mviMode: 'advisory', now: () => NOW, sleep }, validator,
      );

      await useCase.execute(visualDto!);

      expect(aiGenerator.generateQuestion.mock.calls[0][0]).not.toContain('Tu intento anterior');
      const secondPrompt = aiGenerator.generateQuestion.mock.calls[1][0];
      expect(secondPrompt).toContain('opciones muy largas');
      expect(secondPrompt).not.toContain('ignorar');
      const payload = repo.createWithOptionsAndEmbedding.mock.calls[0][0];
      expect(payload.statement).toBe('segundo');
      expect(payload.mviStatus).toBe('passed');
      expect(payload.mviResult).toMatchObject({ attempts: 2 });
      expect(sleep).not.toHaveBeenCalled();
      expect(embeddingAdapter.embed).toHaveBeenCalledTimes(1);
      expect(embeddingAdapter.embed).toHaveBeenCalledWith('segundo');
      expect(imageGenerator.generateImage).toHaveBeenCalledTimes(1);
    });

    it('revises the rejected attempt in place instead of generating a fresh prompt', async () => {
      aiGenerator.generateQuestion
        .mockResolvedValueOnce(generated('primero'))
        .mockResolvedValueOnce(generated('segundo'));
      validator.validate
        .mockResolvedValueOnce(batch(false, [blocking('palabra fuera de nivel: dibujaría')]))
        .mockResolvedValueOnce(batch(true));

      await build('advisory').execute(visualDto!);

      const first = aiGenerator.generateQuestion.mock.calls[0][0];
      const second = aiGenerator.generateQuestion.mock.calls[1][0];
      expect(first).toContain('semilla de variación');
      expect(second).not.toContain('semilla de variación');
      expect(second).toContain('"statement":"primero"');
      expect(second).toContain('palabra fuera de nivel: dibujaría');
      expect(second).toContain('mismas 4 opciones');
    });

    it('treats a revision that changes an option vakValue as invalid and revises the rejected attempt again', async () => {
      const swapped = {
        statement: 'cambiado',
        options: validGenerated.options.map((o, i) => (i === 0 ? { ...o, vakValue: 'K' as const } : o)),
      };
      aiGenerator.generateQuestion
        .mockResolvedValueOnce(generated('primero'))
        .mockResolvedValueOnce(swapped)
        .mockResolvedValueOnce(generated('tercero'));
      validator.validate
        .mockResolvedValueOnce(batch(false, [blocking('razon')]))
        .mockResolvedValueOnce(batch(true));

      await build('advisory').execute(visualDto!);

      expect(validator.validate).toHaveBeenCalledTimes(2);
      expect(validator.validate.mock.calls[1][0][0].statement).toBe('tercero');
      const third = aiGenerator.generateQuestion.mock.calls[2][0];
      expect(third).toContain('"statement":"primero"');
      expect(third).not.toContain('cambiado');
      expect(repo.createWithOptionsAndEmbedding.mock.calls[0][0].statement).toBe('tercero');
    });

    it('revises the rejected attempt after an AI error', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      aiGenerator.generateQuestion
        .mockResolvedValueOnce(generated('primero'))
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(generated('tercero'));
      validator.validate
        .mockResolvedValueOnce(batch(false, [blocking('razon')]))
        .mockResolvedValueOnce(batch(true));
      useCase = new GenerateQuestionUseCase(
        repo, aiGenerator, embeddingAdapter, imageGenerator, imageStorage,
        { maxAttempts: 3, mviMode: 'advisory', now: () => NOW, sleep: jest.fn().mockResolvedValue(undefined) },
        validator,
      );

      await useCase.execute(visualDto!);

      expect(aiGenerator.generateQuestion.mock.calls[2][0]).toContain('"statement":"primero"');
    });

    it('advisory: saves the attempt with the fewest blocking violations as failed, embedding and imaging only it', async () => {
      aiGenerator.generateQuestion
        .mockResolvedValueOnce(generated('uno'))
        .mockResolvedValueOnce(generated('dos'))
        .mockResolvedValueOnce(generated('tres'));
      validator.validate
        .mockResolvedValueOnce(batch(false, [blocking('a'), blocking('b')]))
        .mockResolvedValueOnce(batch(false, [blocking('c')]))
        .mockResolvedValueOnce(batch(false, [blocking('d'), blocking('e'), blocking('f')]));

      await build('advisory').execute(visualDto!);

      expect(repo.createWithOptionsAndEmbedding).toHaveBeenCalledTimes(1);
      const payload = repo.createWithOptionsAndEmbedding.mock.calls[0][0];
      expect(payload.statement).toBe('dos');
      expect(payload.mviStatus).toBe('failed');
      expect(payload.mviResult).toEqual({ approved: false, violations: [blocking('c')], attempts: 3 });
      expect(payload.mviCatalogVersion).toBe('v1.2');
      expect(payload.mviValidatedAt).toEqual(NOW);
      expect(embeddingAdapter.embed).toHaveBeenCalledTimes(1);
      expect(embeddingAdapter.embed).toHaveBeenCalledWith('dos');
      expect(imageGenerator.generateImage).toHaveBeenCalledTimes(1);
      expect(imageStorage.upload).toHaveBeenCalledTimes(1);
    });

    it('breaks ties on blocking count by keeping the earliest attempt', async () => {
      aiGenerator.generateQuestion
        .mockResolvedValueOnce(generated('uno'))
        .mockResolvedValueOnce(generated('dos'));
      validator.validate
        .mockResolvedValueOnce(batch(false, [blocking('a')]))
        .mockResolvedValueOnce(batch(false, [blocking('b')]));

      await build('advisory', true, 2).execute(visualDto!);

      expect(repo.createWithOptionsAndEmbedding.mock.calls[0][0].statement).toBe('uno');
    });

    it('gate: throws 503 and saves nothing when every attempt is blocked', async () => {
      aiGenerator.generateQuestion.mockResolvedValue(validGenerated);
      validator.validate.mockResolvedValue(batch(false, [blocking('x')]));

      await expect(build('gate').execute(visualDto!)).rejects.toMatchObject({
        statusCode: 503,
        message: 'Generated Visual question did not pass MVI after 3 attempts',
      });
      expect(repo.createWithOptionsAndEmbedding).not.toHaveBeenCalled();
      expect(embeddingAdapter.embed).not.toHaveBeenCalled();
      expect(imageGenerator.generateImage).not.toHaveBeenCalled();
    });

    it('saves as unavailable without regenerating when the validator throws', async () => {
      aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
      validator.validate.mockRejectedValueOnce(new Error('MVI down'));

      await build('gate').execute(visualDto!);

      expect(aiGenerator.generateQuestion).toHaveBeenCalledTimes(1);
      const payload = repo.createWithOptionsAndEmbedding.mock.calls[0][0];
      expect(payload.mviStatus).toBe('unavailable');
      expect(payload.mviResult).toBeNull();
      expect(payload.mviCatalogVersion).toBeNull();
      expect(payload.mviValidatedAt).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });

    it('advisory: saves the best validated attempt when later attempts are invalid', async () => {
      aiGenerator.generateQuestion
        .mockResolvedValueOnce(generated('valida'))
        .mockResolvedValueOnce({ statement: '', options: [] } as any)
        .mockResolvedValueOnce({ statement: '', options: [] } as any);
      validator.validate.mockResolvedValueOnce(batch(false, [blocking('a')]));

      await build('advisory').execute(visualDto!);

      const payload = repo.createWithOptionsAndEmbedding.mock.calls[0][0];
      expect(payload.statement).toBe('valida');
      expect(payload.mviStatus).toBe('failed');
      expect(payload.mviResult).toMatchObject({ attempts: 3 });
    });

    it('gate: throws when later attempts are invalid after a blocked one', async () => {
      aiGenerator.generateQuestion
        .mockResolvedValueOnce(generated('valida'))
        .mockResolvedValue({ statement: '', options: [] } as any);
      validator.validate.mockResolvedValueOnce(batch(false, [blocking('a')]));

      await expect(build('gate').execute(visualDto!)).rejects.toMatchObject({ statusCode: 503 });
      expect(repo.createWithOptionsAndEmbedding).not.toHaveBeenCalled();
    });

    it('advisory: saves the best attempt when the AI errors on the last attempt', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      aiGenerator.generateQuestion
        .mockResolvedValueOnce(generated('valida'))
        .mockRejectedValue(new Error('ai down'));
      validator.validate.mockResolvedValueOnce(batch(false, [blocking('a')]));
      useCase = new GenerateQuestionUseCase(
        repo, aiGenerator, embeddingAdapter, imageGenerator, imageStorage,
        { maxAttempts: 2, mviMode: 'advisory', now: () => NOW, sleep: jest.fn().mockResolvedValue(undefined) },
        validator,
      );

      await useCase.execute(visualDto!);

      expect(repo.createWithOptionsAndEmbedding.mock.calls[0][0].mviStatus).toBe('failed');
    });
  });
});
