import { SaveQuestionnaireProgressUseCase } from '../../../../../src/domain/use-cases/questionnaire/save-questionnaire-progress.use-case.js';
import { GetActiveQuestionnaireUseCase } from '../../../../../src/domain/use-cases/questionnaire/get-active-questionnaire.use-case.js';
import { SaveQuestionnaireProgressDto } from '../../../../../src/domain/dtos/questionnaire/save-questionnaire-progress.dto.js';
import { QuestionnaireRepository } from '../../../../../src/domain/repositories/questionnaire.repository.js';
import { QuestionnaireEntity } from '../../../../../src/domain/entities/questionnaire.entity.js';
import { ActiveQuestionnaireData, SavedAnswerView } from '../../../../../src/domain/interfaces/questionnaire/index.js';

const OWNER_ID = 3;
const QUESTIONNAIRE_ID = 10;

function makeQuestionnaire(status = 'in_progress', studentId = OWNER_ID): QuestionnaireEntity {
  return new QuestionnaireEntity(
    QUESTIONNAIRE_ID, studentId, status, new Date(), new Date(), new Date(), null, false, null, null,
  );
}

function saved(questionId: number, selectedOptionId: number | null): SavedAnswerView {
  return { questionId, selectedOptionId, questionTimeSeconds: 3, numberOfChanges: 0, timesReviewed: 0 };
}

function makeRepo(): jest.Mocked<QuestionnaireRepository> {
  return {
    findById: jest.fn().mockResolvedValue(makeQuestionnaire()),
    findQuestionOptions: jest.fn().mockResolvedValue([
      { questionId: 101, optionIds: [1011, 1012] },
      { questionId: 102, optionIds: [1021, 1022] },
    ]),
    saveProgress: jest.fn().mockResolvedValue([saved(101, 1011)]),
    findActiveWithQuestions: jest.fn(),
  } as unknown as jest.Mocked<QuestionnaireRepository>;
}

function dto(answers: object[]): SaveQuestionnaireProgressDto {
  const [error, parsed] = SaveQuestionnaireProgressDto.create({ answers });
  if (error) throw new Error(error);
  return parsed!;
}

describe('SaveQuestionnaireProgressUseCase (HU-29 S1)', () => {
  let repo: jest.Mocked<QuestionnaireRepository>;
  let useCase: SaveQuestionnaireProgressUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new SaveQuestionnaireProgressUseCase(repo);
  });

  it('upserts the answers of the student own in-progress questionnaire and returns the saved progress', async () => {
    const result = await useCase.execute(QUESTIONNAIRE_ID, OWNER_ID, dto([{ questionId: 101, selectedOptionId: 1011 }]));

    expect(repo.saveProgress).toHaveBeenCalledWith(QUESTIONNAIRE_ID, [
      { questionId: 101, selectedOptionId: 1011, questionTimeSeconds: 0, numberOfChanges: 0, timesReviewed: 0 },
    ]);
    expect(result).toEqual({ questionnaireId: QUESTIONNAIRE_ID, answers: [saved(101, 1011)] });
  });

  it('throws 404 when the questionnaire does not exist', async () => {
    repo.findById.mockResolvedValueOnce(null);

    await expect(useCase.execute(QUESTIONNAIRE_ID, OWNER_ID, dto([{ questionId: 101, selectedOptionId: 1011 }])))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(repo.saveProgress).not.toHaveBeenCalled();
  });

  it('throws 403 when the questionnaire belongs to another student', async () => {
    repo.findById.mockResolvedValueOnce(makeQuestionnaire('in_progress', 999));

    await expect(useCase.execute(QUESTIONNAIRE_ID, OWNER_ID, dto([{ questionId: 101, selectedOptionId: 1011 }])))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(repo.saveProgress).not.toHaveBeenCalled();
  });

  it.each(['completed', 'abandoned'])('throws 400 when the questionnaire is %s', async (status) => {
    repo.findById.mockResolvedValueOnce(makeQuestionnaire(status));

    await expect(useCase.execute(QUESTIONNAIRE_ID, OWNER_ID, dto([{ questionId: 101, selectedOptionId: 1011 }])))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(repo.saveProgress).not.toHaveBeenCalled();
  });

  it.each([
    ['a question outside the questionnaire', [{ questionId: 999, selectedOptionId: 1 }]],
    ['an option of another question', [{ questionId: 101, selectedOptionId: 1021 }]],
    ['the same question twice', [{ questionId: 101, selectedOptionId: 1011 }, { questionId: 101, selectedOptionId: 1012 }]],
  ])('throws 400 for %s', async (_label, answers) => {
    await expect(useCase.execute(QUESTIONNAIRE_ID, OWNER_ID, dto(answers)))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(repo.saveProgress).not.toHaveBeenCalled();
  });

  it('accepts a skipped (null) option', async () => {
    await useCase.execute(QUESTIONNAIRE_ID, OWNER_ID, dto([{ questionId: 102, selectedOptionId: null }]));

    expect(repo.saveProgress).toHaveBeenCalledTimes(1);
  });
});

describe('GetActiveQuestionnaireUseCase resume fields (HU-29 S1)', () => {
  function active(answers: SavedAnswerView[]): ActiveQuestionnaireData {
    return {
      id: QUESTIONNAIRE_ID, studentId: OWNER_ID, status: 'in_progress', startTime: new Date(),
      usedFallback: false, createdAt: new Date(), updatedAt: new Date(),
      questions: [101, 102, 103].map((questionId, i) => ({
        order: i + 1, questionId, statement: `Q${questionId}`, contentType: 'text', mediaUrl: null, options: [],
      })),
      answers,
    };
  }

  let repo: jest.Mocked<QuestionnaireRepository>;
  let useCase: GetActiveQuestionnaireUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new GetActiveQuestionnaireUseCase(repo);
  });

  it('starts at the first question when nothing was saved', async () => {
    repo.findActiveWithQuestions.mockResolvedValueOnce(active([]));

    const result = await useCase.execute(OWNER_ID);

    expect(result.answers).toEqual([]);
    expect(result.answeredCount).toBe(0);
    expect(result.resumeIndex).toBe(0);
  });

  it('resumes at the first question without a saved option', async () => {
    repo.findActiveWithQuestions.mockResolvedValueOnce(active([saved(101, 1011), saved(102, null)]));

    const result = await useCase.execute(OWNER_ID);

    expect(result.answers).toHaveLength(2);
    expect(result.answeredCount).toBe(1);
    expect(result.resumeIndex).toBe(1);
  });

  it('points at the last question when every question has a saved option', async () => {
    repo.findActiveWithQuestions.mockResolvedValueOnce(
      active([saved(101, 1011), saved(102, 1021), saved(103, 1031)]),
    );

    const result = await useCase.execute(OWNER_ID);

    expect(result.answeredCount).toBe(3);
    expect(result.resumeIndex).toBe(2);
  });

  it('throws 404 when the student has no active questionnaire', async () => {
    repo.findActiveWithQuestions.mockResolvedValueOnce(null);

    await expect(useCase.execute(OWNER_ID)).rejects.toMatchObject({ statusCode: 404 });
  });
});
