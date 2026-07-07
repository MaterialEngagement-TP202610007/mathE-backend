import { BulkGenerateQuestionsUseCase } from '../../../../../src/domain/use-cases/question/bulk-generate-questions.use-case.js';
import { GenerateQuestionUseCase } from '../../../../../src/domain/use-cases/question/generate-question.use-case.js';
import { GenerateQuestionDto } from '../../../../../src/domain/dtos/question/generate-question.dto.js';
import { QuestionEntity } from '../../../../../src/domain/entities/question.entity.js';
import { QuestionRepository } from '../../../../../src/domain/repositories/question.repository.js';
import { NotificationRepository } from '../../../../../src/domain/repositories/notification.repository.js';
import { CustomError } from '../../../../../src/domain/error/custom-error.js';

function makeEntity(id: number): QuestionEntity {
  return new QuestionEntity(
    id, `Pregunta ${id}`, 'text', 'Visual',
    'ai_generated', 'pending', new Date(), new Date(), new Date(),
    null, null, null, null, [],
  );
}

function makeGenerateUseCase(): jest.Mocked<Pick<GenerateQuestionUseCase, 'execute'>> {
  return { execute: jest.fn() } as unknown as jest.Mocked<Pick<GenerateQuestionUseCase, 'execute'>>;
}

function makeQuestionRepo(): jest.Mocked<QuestionRepository> {
  return {
    findRecentStatementsByVakStyle: jest.fn().mockResolvedValue([]),
    createWithOptionsAndEmbedding: jest.fn(),
    findApprovedByStyle: jest.fn(),
    findByTeacher: jest.fn(),
    findById: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    softDelete: jest.fn(),
  } as unknown as jest.Mocked<QuestionRepository>;
}

function makeNotificationRepo(): jest.Mocked<NotificationRepository> {
  return {
    create: jest.fn().mockResolvedValue({}),
    findByStudent: jest.fn(),
    findById: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    countUnread: jest.fn(),
  } as unknown as jest.Mocked<NotificationRepository>;
}

const [, visualDto] = GenerateQuestionDto.create({ vakStyle: 'Visual', teacherId: 1 });

describe('BulkGenerateQuestionsUseCase', () => {
  let generateUseCase: jest.Mocked<Pick<GenerateQuestionUseCase, 'execute'>>;
  let questionRepo: jest.Mocked<QuestionRepository>;
  let notificationRepo: jest.Mocked<NotificationRepository>;
  let useCase: BulkGenerateQuestionsUseCase;

  beforeEach(() => {
    generateUseCase = makeGenerateUseCase();
    questionRepo = makeQuestionRepo();
    notificationRepo = makeNotificationRepo();
    useCase = new BulkGenerateQuestionsUseCase(
      generateUseCase as unknown as GenerateQuestionUseCase,
      notificationRepo,
      questionRepo,
    );
  });

  it('loads recent statements before generation', async () => {
    generateUseCase.execute.mockResolvedValue(makeEntity(1));

    await useCase.execute(visualDto!, 1, 5);

    expect(questionRepo.findRecentStatementsByVakStyle).toHaveBeenCalledWith('Visual', 20);
  });

  it('generates requested count of questions', async () => {
    generateUseCase.execute
      .mockResolvedValueOnce(makeEntity(1))
      .mockResolvedValueOnce(makeEntity(2))
      .mockResolvedValueOnce(makeEntity(3));

    const result = await useCase.execute(visualDto!, 3, 5);

    expect(generateUseCase.execute).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
  });

  it('calls onGenerated callback for each successful question', async () => {
    generateUseCase.execute.mockResolvedValue(makeEntity(1));
    const onGenerated = jest.fn();

    await useCase.execute(visualDto!, 2, 5, { onGenerated, onFailed: jest.fn() });

    expect(onGenerated).toHaveBeenCalledTimes(2);
  });

  it('calls onFailed callback when a question fails', async () => {
    generateUseCase.execute
      .mockResolvedValueOnce(makeEntity(1))
      .mockRejectedValueOnce(CustomError.serviceUnavailable('generation failed'));
    const onFailed = jest.fn();

    await useCase.execute(visualDto!, 2, 5, { onGenerated: jest.fn(), onFailed });

    expect(onFailed).toHaveBeenCalledTimes(1);
  });

  it('returns only successful questions when some fail', async () => {
    generateUseCase.execute
      .mockResolvedValueOnce(makeEntity(1))
      .mockRejectedValueOnce(CustomError.serviceUnavailable('fail'));

    const result = await useCase.execute(visualDto!, 2, 5);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('throws 503 when all questions fail', async () => {
    generateUseCase.execute.mockRejectedValue(CustomError.serviceUnavailable('fail'));

    await expect(useCase.execute(visualDto!, 3, 5)).rejects.toMatchObject({ statusCode: 503 });
  });

  it('creates notification with correct count after success', async () => {
    generateUseCase.execute
      .mockResolvedValueOnce(makeEntity(1))
      .mockResolvedValueOnce(makeEntity(2));

    await useCase.execute(visualDto!, 2, 7);

    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 7,
        type: 'questions_generated',
        message: expect.stringContaining('2'),
      }),
    );
  });
});
