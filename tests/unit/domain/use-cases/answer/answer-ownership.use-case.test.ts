import { ListAnswersUseCase } from '../../../../../src/domain/use-cases/answer/list-answers.use-case.js';
import { GetAnswerUseCase } from '../../../../../src/domain/use-cases/answer/get-answer.use-case.js';
import { CreateAnswerUseCase } from '../../../../../src/domain/use-cases/answer/create-answer.use-case.js';
import { AnswerRepository } from '../../../../../src/domain/repositories/answer.repository.js';
import { QuestionnaireRepository } from '../../../../../src/domain/repositories/questionnaire.repository.js';
import { QuestionnaireEntity } from '../../../../../src/domain/entities/questionnaire.entity.js';
import { PaginationDto } from '../../../../../src/domain/dtos/shared/pagination.dto.js';
import { CreateAnswerDto } from '../../../../../src/domain/dtos/answer/create-answer.dto.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

const OWNER_ID = 3;
const owner = { id: OWNER_ID, roleId: ROLES.STUDENT };
const otherStudent = { id: 999, roleId: ROLES.STUDENT };
const teacher = { id: 50, roleId: ROLES.TEACHER };

function makeQuestionnaire(): QuestionnaireEntity {
  return new QuestionnaireEntity(
    10, OWNER_ID, 'in_progress', new Date(), new Date(), new Date(), null, false, null, null,
  );
}

function makeAnswerRepo(): jest.Mocked<AnswerRepository> {
  return {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    createMany: jest.fn(),
    findByQuestionnaire: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 }),
    findById: jest.fn().mockResolvedValue({ id: 1 }),
    findAllWithOptions: jest.fn(),
  } as unknown as jest.Mocked<AnswerRepository>;
}

function makeQuestionnaireRepo(): jest.Mocked<QuestionnaireRepository> {
  return {
    findById: jest.fn().mockResolvedValue(makeQuestionnaire()),
  } as unknown as jest.Mocked<QuestionnaireRepository>;
}

const [, pagination] = PaginationDto.create(1, 10);

describe('Answer use cases — questionnaire ownership', () => {
  let answerRepo: jest.Mocked<AnswerRepository>;
  let questionnaireRepo: jest.Mocked<QuestionnaireRepository>;

  beforeEach(() => {
    answerRepo = makeAnswerRepo();
    questionnaireRepo = makeQuestionnaireRepo();
  });

  describe('ListAnswersUseCase', () => {
    it('lists answers for the owner student', async () => {
      const useCase = new ListAnswersUseCase(answerRepo, questionnaireRepo);

      await expect(useCase.execute(10, owner, pagination!)).resolves.toMatchObject({ total: 0 });
      expect(answerRepo.findByQuestionnaire).toHaveBeenCalledWith(10, pagination);
    });

    it('lists answers for a teacher', async () => {
      const useCase = new ListAnswersUseCase(answerRepo, questionnaireRepo);

      await expect(useCase.execute(10, teacher, pagination!)).resolves.toBeDefined();
    });

    it('throws 403 for another student', async () => {
      const useCase = new ListAnswersUseCase(answerRepo, questionnaireRepo);

      await expect(useCase.execute(10, otherStudent, pagination!)).rejects.toMatchObject({ statusCode: 403 });
      expect(answerRepo.findByQuestionnaire).not.toHaveBeenCalled();
    });

    it('throws 404 when the questionnaire does not exist', async () => {
      questionnaireRepo.findById.mockResolvedValueOnce(null);
      const useCase = new ListAnswersUseCase(answerRepo, questionnaireRepo);

      await expect(useCase.execute(10, owner, pagination!)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('GetAnswerUseCase', () => {
    it('returns the answer to the owner student', async () => {
      const useCase = new GetAnswerUseCase(answerRepo, questionnaireRepo);

      await expect(useCase.execute(1, 10, owner)).resolves.toMatchObject({ id: 1 });
    });

    it('throws 403 for another student', async () => {
      const useCase = new GetAnswerUseCase(answerRepo, questionnaireRepo);

      await expect(useCase.execute(1, 10, otherStudent)).rejects.toMatchObject({ statusCode: 403 });
      expect(answerRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe('CreateAnswerUseCase', () => {
    const [, dto] = CreateAnswerDto.create({ questionnaireId: 10, questionId: 101, selectedOptionId: 1011 });

    it('creates an answer in the student own questionnaire', async () => {
      const useCase = new CreateAnswerUseCase(answerRepo, questionnaireRepo);

      await expect(useCase.execute(dto!, OWNER_ID)).resolves.toMatchObject({ id: 1 });
    });

    it('throws 403 when answering another student questionnaire', async () => {
      const useCase = new CreateAnswerUseCase(answerRepo, questionnaireRepo);

      await expect(useCase.execute(dto!, 999)).rejects.toMatchObject({ statusCode: 403 });
      expect(answerRepo.create).not.toHaveBeenCalled();
    });
  });
});
