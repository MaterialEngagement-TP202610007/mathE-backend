import { AbandonQuestionnaireUseCase } from '../../../../../src/domain/use-cases/questionnaire/abandon-questionnaire.use-case.js';
import { GetQuestionnaireUseCase } from '../../../../../src/domain/use-cases/questionnaire/get-questionnaire.use-case.js';
import { QuestionnaireRepository } from '../../../../../src/domain/repositories/questionnaire.repository.js';
import { QuestionnaireEntity } from '../../../../../src/domain/entities/questionnaire.entity.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

const OWNER_ID = 3;

function makeQuestionnaire(status = 'in_progress'): QuestionnaireEntity {
  return new QuestionnaireEntity(
    10, OWNER_ID, status, new Date(), new Date(), new Date(), null, false, null, null,
  );
}

function makeRepo(): jest.Mocked<QuestionnaireRepository> {
  return {
    findById: jest.fn(),
    abandon: jest.fn(),
  } as unknown as jest.Mocked<QuestionnaireRepository>;
}

describe('AbandonQuestionnaireUseCase', () => {
  let repo: jest.Mocked<QuestionnaireRepository>;
  let useCase: AbandonQuestionnaireUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new AbandonQuestionnaireUseCase(repo);
  });

  it('abandons the student own in-progress questionnaire', async () => {
    const abandoned = makeQuestionnaire('abandoned');
    repo.findById.mockResolvedValueOnce(makeQuestionnaire());
    repo.abandon.mockResolvedValueOnce(abandoned);

    await expect(useCase.execute(10, OWNER_ID)).resolves.toBe(abandoned);
    expect(repo.abandon).toHaveBeenCalledWith(10);
  });

  it('throws 403 when the questionnaire belongs to another student', async () => {
    repo.findById.mockResolvedValueOnce(makeQuestionnaire());

    await expect(useCase.execute(10, 999)).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.abandon).not.toHaveBeenCalled();
  });

  it('throws 404 when the questionnaire does not exist', async () => {
    repo.findById.mockResolvedValueOnce(null);

    await expect(useCase.execute(10, OWNER_ID)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when the questionnaire is not in progress', async () => {
    repo.findById.mockResolvedValueOnce(makeQuestionnaire('completed'));

    await expect(useCase.execute(10, OWNER_ID)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('GetQuestionnaireUseCase', () => {
  let repo: jest.Mocked<QuestionnaireRepository>;
  let useCase: GetQuestionnaireUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new GetQuestionnaireUseCase(repo);
  });

  it('returns the questionnaire to its owner student', async () => {
    const questionnaire = makeQuestionnaire();
    repo.findById.mockResolvedValueOnce(questionnaire);

    await expect(
      useCase.execute(10, { id: OWNER_ID, roleId: ROLES.STUDENT }),
    ).resolves.toBe(questionnaire);
  });

  it('throws 403 when another student requests it', async () => {
    repo.findById.mockResolvedValueOnce(makeQuestionnaire());

    await expect(
      useCase.execute(10, { id: 999, roleId: ROLES.STUDENT }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it.each([ROLES.TEACHER, ROLES.ADMIN])('allows staff role %s to read any questionnaire', async (roleId) => {
    const questionnaire = makeQuestionnaire();
    repo.findById.mockResolvedValueOnce(questionnaire);

    await expect(useCase.execute(10, { id: 50, roleId })).resolves.toBe(questionnaire);
  });

  it('throws 403 when the requester has no role', async () => {
    repo.findById.mockResolvedValueOnce(makeQuestionnaire());

    await expect(
      useCase.execute(10, { id: 999, roleId: null }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 404 when the questionnaire does not exist', async () => {
    repo.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute(10, { id: OWNER_ID, roleId: ROLES.STUDENT }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
