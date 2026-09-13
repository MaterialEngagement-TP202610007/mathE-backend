import { CreateQuestionnaireUseCase } from '../../../../../src/domain/use-cases/questionnaire/create-questionnaire.use-case.js';
import { QuestionnaireRepository } from '../../../../../src/domain/repositories/questionnaire.repository.js';
import { ApprovedQuestionSlim, QuestionRepository } from '../../../../../src/domain/repositories/question.repository.js';
import { UserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { FallbackQuestionsAdapter } from '../../../../../src/domain/adapters/fallback-questions.adapter.js';
import { FallbackQuestionTemplate, QuestionnaireCreationParams } from '../../../../../src/domain/interfaces/questionnaire/index.js';
import { UserEntity } from '../../../../../src/domain/entities/user.entity.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';
import { VAK_STYLES, VakStyle } from '../../../../../src/domain/constants/vak.constant.js';

const SCHOOL_A = 1;
const SCHOOL_B = 2;
const STUDENT_A = 100;
const STUDENT_B = 200;
const STUDENT_NO_SCHOOL = 300;

interface StoredQuestion {
  id: number;
  schoolId: number | null;
  vakStyle: VakStyle;
}

function makeStudent(id: number, schoolId: number | null): UserEntity {
  return new UserEntity(
    id, 'hash', `student${id}@example.com`, 'Student', new Date('2012-01-01'),
    new Date(), new Date(), null, true, ROLES.STUDENT, null, schoolId, null,
  );
}

/** Seeds `count` approved questions per style for a school, with ids starting at `firstId`. */
function bank(schoolId: number, firstId: number, counts: Record<VakStyle, number>): StoredQuestion[] {
  const out: StoredQuestion[] = [];
  let id = firstId;
  for (const style of VAK_STYLES) {
    for (let i = 0; i < counts[style]; i++) out.push({ id: id++, schoolId, vakStyle: style });
  }
  return out;
}

/** In-memory question repository honouring the school filter like the real one. */
function makeQuestionRepo(stored: StoredQuestion[]): jest.Mocked<QuestionRepository> {
  return {
    findApprovedByStyle: jest.fn(async (vakStyle: string, limit: number, schoolId: number) =>
      stored
        .filter((q) => q.vakStyle === vakStyle && q.schoolId === schoolId)
        .slice(0, limit)
        .map<ApprovedQuestionSlim>((q) => ({
          id: q.id, statement: `Q${q.id}`, contentType: 'text', mediaUrl: null, options: [],
        })),
    ),
  } as unknown as jest.Mocked<QuestionRepository>;
}

function makeFallbackAdapter(): FallbackQuestionsAdapter {
  return {
    getByStyle: (vakStyle: string): FallbackQuestionTemplate[] =>
      Array.from({ length: 6 }, (_, i) => ({
        statement: `${vakStyle} fallback ${i}`,
        contentType: 'text',
        vakStyle,
        options: [],
      })),
  };
}

function makeQuestionnaireRepo(): jest.Mocked<QuestionnaireRepository> {
  return {
    findInProgressByStudent: jest.fn().mockResolvedValue(null),
    createWithQuestions: jest.fn(async (params: QuestionnaireCreationParams) => ({
      id: 1, studentId: params.studentId, status: 'in_progress', startTime: new Date(),
      usedFallback: params.usedFallback, createdAt: new Date(), updatedAt: new Date(), questions: [],
    })),
  } as unknown as jest.Mocked<QuestionnaireRepository>;
}

function makeUserRepo(): jest.Mocked<UserRepository> {
  const students = [
    makeStudent(STUDENT_A, SCHOOL_A),
    makeStudent(STUDENT_B, SCHOOL_B),
    makeStudent(STUDENT_NO_SCHOOL, null),
  ];
  return {
    findById: jest.fn(async (id: number) => students.find((s) => s.id === id) ?? null),
  } as unknown as jest.Mocked<UserRepository>;
}

const FULL = { Visual: 4, Auditory: 3, Kinesthetic: 3 };

function setup(stored: StoredQuestion[]) {
  const questionnaireRepo = makeQuestionnaireRepo();
  const questionRepo = makeQuestionRepo(stored);
  const useCase = new CreateQuestionnaireUseCase(
    questionnaireRepo, questionRepo, makeFallbackAdapter(), makeUserRepo(),
  );
  const params = () => questionnaireRepo.createWithQuestions.mock.calls[0][0];
  return { useCase, questionRepo, params };
}

describe('CreateQuestionnaireUseCase per-school question bank', () => {
  it('uses 100% of the student school bank when every style is covered (no fallback at all)', async () => {
    const schoolA = bank(SCHOOL_A, 1, FULL);
    const { useCase, questionRepo, params } = setup(schoolA);

    await useCase.execute(STUDENT_A);

    const p = params();
    expect(p.usedFallback).toBe(false);
    expect(p.fallbackToCreate).toHaveLength(0);
    expect(p.assignedQuestions).toHaveLength(10);
    const ids = new Set(schoolA.map((q) => q.id));
    for (const q of p.assignedQuestions) expect(ids.has(q.questionId)).toBe(true);
    expect(p.assignedQuestions.map((q) => q.order).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const call of questionRepo.findApprovedByStyle.mock.calls) expect(call[2]).toBe(SCHOOL_A);
  });

  it("never serves school A's approved questions to a student of school B", async () => {
    const schoolA = bank(SCHOOL_A, 1, FULL);
    const schoolB = bank(SCHOOL_B, 1000, FULL);
    const { useCase, questionRepo, params } = setup([...schoolA, ...schoolB]);

    await useCase.execute(STUDENT_B);

    const schoolAIds = new Set(schoolA.map((q) => q.id));
    const p = params();
    expect(p.usedFallback).toBe(false);
    expect(p.assignedQuestions).toHaveLength(10);
    for (const q of p.assignedQuestions) expect(schoolAIds.has(q.questionId)).toBe(false);
    for (const call of questionRepo.findApprovedByStyle.mock.calls) expect(call[2]).toBe(SCHOOL_B);
  });

  it("falls back entirely for school B even when school A's bank is full", async () => {
    const { useCase, params } = setup(bank(SCHOOL_A, 1, FULL));

    await useCase.execute(STUDENT_B);

    const p = params();
    expect(p.usedFallback).toBe(true);
    expect(p.assignedQuestions).toHaveLength(0);
    expect(p.fallbackToCreate).toHaveLength(10);
  });

  it('uses 100% fallback when a single style is short, never mixing sources', async () => {
    const { useCase, params } = setup(bank(SCHOOL_A, 1, { Visual: 10, Auditory: 10, Kinesthetic: 2 }));

    await useCase.execute(STUDENT_A);

    const p = params();
    expect(p.usedFallback).toBe(true);
    expect(p.assignedQuestions).toHaveLength(0);
    expect(p.fallbackToCreate).toHaveLength(10);
    const perStyle = (style: string) => p.fallbackToCreate.filter((f) => f.vakStyle === style).length;
    expect([perStyle('Visual'), perStyle('Auditory'), perStyle('Kinesthetic')]).toEqual([4, 3, 3]);
  });

  it('uses 100% fallback for a student without school, without querying the bank', async () => {
    const { useCase, questionRepo, params } = setup(bank(SCHOOL_A, 1, FULL));

    await useCase.execute(STUDENT_NO_SCHOOL);

    const p = params();
    expect(p.usedFallback).toBe(true);
    expect(p.assignedQuestions).toHaveLength(0);
    expect(p.fallbackToCreate).toHaveLength(10);
    expect(questionRepo.findApprovedByStyle).not.toHaveBeenCalled();
  });

  it.each([
    ['school bank', FULL],
    ['short bank', { Visual: 4, Auditory: 2, Kinesthetic: 3 }],
  ])('never mixes DB and fallback questions (%s)', async (_label, counts) => {
    const { useCase, params } = setup(bank(SCHOOL_A, 1, counts));

    await useCase.execute(STUDENT_A);

    const p = params();
    const sources = [p.assignedQuestions.length > 0, p.fallbackToCreate.length > 0].filter(Boolean);
    expect(sources).toHaveLength(1);
    expect(p.assignedQuestions.length + p.fallbackToCreate.length).toBe(10);
  });

  it('rejects with 409 when the student already has a questionnaire in progress', async () => {
    const { useCase } = setup([]);
    const repo = (useCase as unknown as { questionnaireRepository: jest.Mocked<QuestionnaireRepository> })
      .questionnaireRepository;
    repo.findInProgressByStudent.mockResolvedValueOnce({} as never);

    await expect(useCase.execute(STUDENT_A)).rejects.toMatchObject({ statusCode: 409 });
  });
});
