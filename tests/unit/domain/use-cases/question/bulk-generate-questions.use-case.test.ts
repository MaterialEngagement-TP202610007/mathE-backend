import { BulkGenerateQuestionsUseCase } from '../../../../../src/domain/use-cases/question/bulk-generate-questions.use-case.js';
import { GenerateQuestionUseCase } from '../../../../../src/domain/use-cases/question/generate-question.use-case.js';
import { GenerateQuestionDto } from '../../../../../src/domain/dtos/question/generate-question.dto.js';
import { QuestionEntity } from '../../../../../src/domain/entities/question.entity.js';
import { QuestionRepository } from '../../../../../src/domain/repositories/question.repository.js';
import { NotificationRepository } from '../../../../../src/domain/repositories/notification.repository.js';
import { UserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { UserEntity } from '../../../../../src/domain/entities/user.entity.js';
import { CustomError } from '../../../../../src/domain/error/custom-error.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

const TEACHER_SCHOOL_ID = 4;

function makeTeacher(id: number, schoolId: number | null): UserEntity {
  return new UserEntity(
    id, 'hash', `teacher${id}@example.com`, 'Teacher', new Date('1990-01-01'),
    new Date(), new Date(), null, true, ROLES.TEACHER, null, schoolId, null,
  );
}

function makeUserRepo(users: UserEntity[] = [makeTeacher(1, TEACHER_SCHOOL_ID)]): jest.Mocked<UserRepository> {
  return {
    findById: jest.fn(async (id: number) => users.find((u) => u.id === id) ?? null),
  } as unknown as jest.Mocked<UserRepository>;
}

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
  let userRepo: jest.Mocked<UserRepository>;
  let useCase: BulkGenerateQuestionsUseCase;

  beforeEach(() => {
    generateUseCase = makeGenerateUseCase();
    questionRepo = makeQuestionRepo();
    notificationRepo = makeNotificationRepo();
    userRepo = makeUserRepo();
    useCase = new BulkGenerateQuestionsUseCase(
      generateUseCase as unknown as GenerateQuestionUseCase,
      notificationRepo,
      questionRepo,
      userRepo,
    );
  });

  it('loads recent statements of the teacher school before generation', async () => {
    generateUseCase.execute.mockResolvedValue(makeEntity(1));

    await useCase.execute(visualDto!, 1, 5);

    expect(questionRepo.findRecentStatementsByVakStyle).toHaveBeenCalledWith('Visual', 20, TEACHER_SCHOOL_ID);
  });

  it('stamps every generated question with the generating teacher school', async () => {
    generateUseCase.execute.mockResolvedValue(makeEntity(1));

    await useCase.execute(visualDto!, 2, 5);

    expect(generateUseCase.execute).toHaveBeenCalledTimes(2);
    for (const call of generateUseCase.execute.mock.calls) {
      expect(call[2]).toBe(TEACHER_SCHOOL_ID);
    }
  });

  describe('prepare', () => {
    it('resolves the school of the attributed teacher', async () => {
      await expect(useCase.prepare(visualDto!)).resolves.toEqual({ schoolId: TEACHER_SCHOOL_ID });
      expect(userRepo.findById).toHaveBeenCalledWith(1);
    });

    it('rejects with 400 when the teacher has no school, before any AI call', async () => {
      userRepo = makeUserRepo([makeTeacher(1, null)]);
      useCase = new BulkGenerateQuestionsUseCase(
        generateUseCase as unknown as GenerateQuestionUseCase,
        notificationRepo,
        questionRepo,
        userRepo,
      );

      await expect(useCase.prepare(visualDto!)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Teacher must belong to a school to generate questions',
      });
      await expect(useCase.execute(visualDto!, 3, 5)).rejects.toMatchObject({ statusCode: 400 });
      expect(generateUseCase.execute).not.toHaveBeenCalled();
      expect(questionRepo.findRecentStatementsByVakStyle).not.toHaveBeenCalled();
    });

    it('rejects with 404 when the attributed teacher does not exist', async () => {
      const [, unknownTeacherDto] = GenerateQuestionDto.create({ vakStyle: 'Visual', teacherId: 404 });

      await expect(useCase.prepare(unknownTeacherDto!)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Teacher not found',
      });
    });

    it('does not reload the teacher when execute receives a prepared context', async () => {
      generateUseCase.execute.mockResolvedValue(makeEntity(1));

      await useCase.execute(visualDto!, 1, 5, undefined, { schoolId: 8 });

      expect(userRepo.findById).not.toHaveBeenCalled();
      expect(questionRepo.findRecentStatementsByVakStyle).toHaveBeenCalledWith('Visual', 20, 8);
      expect(generateUseCase.execute.mock.calls[0][2]).toBe(8);
    });
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

  it('never runs more generations in parallel than the configured concurrency', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let nextId = 1;
    generateUseCase.execute.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setImmediate(resolve));
      inFlight--;
      return makeEntity(nextId++);
    });
    useCase = new BulkGenerateQuestionsUseCase(
      generateUseCase as unknown as GenerateQuestionUseCase,
      notificationRepo,
      questionRepo,
      userRepo,
      { concurrency: 2 },
    );

    const result = await useCase.execute(visualDto!, 5, 5);

    expect(result).toHaveLength(5);
    expect(generateUseCase.execute).toHaveBeenCalledTimes(5);
    expect(maxInFlight).toBe(2);
  });

  it('keeps generating remaining questions after a failure under limited concurrency', async () => {
    generateUseCase.execute
      .mockRejectedValueOnce(CustomError.serviceUnavailable('fail'))
      .mockResolvedValueOnce(makeEntity(2))
      .mockResolvedValueOnce(makeEntity(3));
    useCase = new BulkGenerateQuestionsUseCase(
      generateUseCase as unknown as GenerateQuestionUseCase,
      notificationRepo,
      questionRepo,
      userRepo,
      { concurrency: 1 },
    );

    const result = await useCase.execute(visualDto!, 3, 5);

    expect(result.map((q) => q.id)).toEqual([2, 3]);
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
