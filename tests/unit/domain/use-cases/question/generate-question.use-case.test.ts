jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

import { GenerateQuestionUseCase, GenerateQuestionConfig } from '../../../../../src/domain/use-cases/question/generate-question.use-case.js';
import { GenerateQuestionDto } from '../../../../../src/domain/dtos/question/generate-question.dto.js';
import { QuestionEntity } from '../../../../../src/domain/entities/question.entity.js';
import { QuestionRepository } from '../../../../../src/domain/repositories/question.repository.js';
import { AIQuestionGeneratorAdapter } from '../../../../../src/domain/adapters/ai-question-generator.adapter.js';
import { EmbeddingAdapter } from '../../../../../src/domain/adapters/embedding.adapter.js';
import { AIImageGeneratorAdapter } from '../../../../../src/domain/adapters/ai-image-generator.adapter.js';
import { ImageStorageAdapter } from '../../../../../src/domain/adapters/image-storage.adapter.js';

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

  it('passes recentStatements to prompt builder', async () => {
    const recent = ['Pregunta A', 'Pregunta B'];
    aiGenerator.generateQuestion.mockResolvedValueOnce(validGenerated);
    repo.createWithOptionsAndEmbedding.mockResolvedValueOnce(makeEntity());

    await useCase.execute(visualDto!, recent);

    const promptArg = aiGenerator.generateQuestion.mock.calls[0][0];
    expect(promptArg).toContain('Pregunta A');
    expect(promptArg).toContain('Pregunta B');
  });
});
