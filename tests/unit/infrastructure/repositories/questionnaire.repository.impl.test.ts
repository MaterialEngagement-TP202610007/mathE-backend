jest.mock('../../../../src/config/database/index.js', () => ({
  prisma: {
    questionnaire: { findFirst: jest.fn() },
    questionnaireQuestion: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '../../../../src/config/database/index.js';
import { QuestionnaireRepositoryImpl } from '../../../../src/infrastructure/repositories/questionnaire.repository.impl.js';

const mocked = prisma as unknown as {
  questionnaire: { findFirst: jest.Mock };
  questionnaireQuestion: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

const dbOptions = [
  { id: 1, text: 'See a diagram', vakValue: 'V', questionId: 10, deletedAt: null },
  { id: 2, text: 'Listen to it', vakValue: 'A', questionId: 10, deletedAt: null },
];

const dbQuestion = {
  id: 10,
  statement: 'How do you learn?',
  contentType: 'text',
  mediaUrl: null,
  vakStyle: 'Visual',
  options: dbOptions,
  // Teacher-only MVI diagnosis stored on the row; must never reach students.
  mviStatus: 'failed',
  mviResult: { approved: false, violations: [], attempts: 3 },
  mviCatalogVersion: 'v1.2',
  mviValidatedAt: new Date(),
  approvedOverMvi: true,
};

const questionnaireRow = {
  id: 5,
  studentId: 42,
  status: 'in_progress',
  startTime: new Date(),
  usedFallback: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function expectNoVakLeak(questions: Array<{ options: object[] }>) {
  expect(questions.length).toBeGreaterThan(0);
  for (const q of questions) {
    expect(q).not.toHaveProperty('vakStyle');
    expect(Object.keys(q).filter((k) => k.startsWith('mvi') || k === 'approvedOverMvi')).toEqual([]);
    for (const option of q.options) {
      expect(option).not.toHaveProperty('vakValue');
      expect(Object.keys(option).sort()).toEqual(['id', 'text']);
    }
  }
}

describe('QuestionnaireRepositoryImpl student-facing views', () => {
  it('findActiveWithQuestions does not expose option vakValue', async () => {
    mocked.questionnaire.findFirst.mockResolvedValueOnce({
      ...questionnaireRow,
      questions: [{ order: 1, question: dbQuestion }],
      answers: [],
    });

    const result = await new QuestionnaireRepositoryImpl().findActiveWithQuestions(42);

    expectNoVakLeak(result!.questions);
  });

  it('findActiveWithQuestions returns the saved answers without VAK data (HU-29)', async () => {
    mocked.questionnaire.findFirst.mockResolvedValueOnce({
      ...questionnaireRow,
      questions: [{ order: 1, question: dbQuestion }],
      answers: [{
        id: 1, questionnaireId: 5, questionId: 10, selectedOptionId: 1, navigationSequence: null,
        questionTimeSeconds: 3.5, numberOfChanges: 1, timesReviewed: null,
        selectedOption: { id: 1, vakValue: 'V' },
      }],
    });

    const result = await new QuestionnaireRepositoryImpl().findActiveWithQuestions(42);

    expect(result!.answers).toEqual([
      { questionId: 10, selectedOptionId: 1, questionTimeSeconds: 3.5, numberOfChanges: 1, timesReviewed: 0 },
    ]);
    const query = mocked.questionnaire.findFirst.mock.calls.at(-1)[0];
    expect(query.include.answers.where).toEqual({ deletedAt: null });
  });

  it('createWithQuestions does not expose option vakValue for DB or fallback questions', async () => {
    const tx = {
      question: {
        findFirst: jest.fn().mockResolvedValue({ ...dbQuestion, id: 11 }),
        findFirstOrThrow: jest.fn().mockResolvedValue(dbQuestion),
        create: jest.fn(),
      },
      questionnaire: { create: jest.fn().mockResolvedValue(questionnaireRow) },
      questionnaireQuestion: { createMany: jest.fn() },
    };
    mocked.$transaction.mockImplementationOnce((fn: (t: typeof tx) => unknown) => fn(tx));

    const result = await new QuestionnaireRepositoryImpl().createWithQuestions({
      studentId: 42,
      usedFallback: true,
      assignedQuestions: [{ questionId: 10, order: 1 }],
      fallbackToCreate: [{
        order: 2,
        statement: 'How do you learn?',
        contentType: 'text',
        vakStyle: 'Visual',
        options: [{ text: 'See a diagram', vakValue: 'V' }],
      }],
    });

    expect(result.questions).toHaveLength(2);
    expectNoVakLeak(result.questions);
  });
});

describe('QuestionnaireRepositoryImpl.findSeenQuestions', () => {
  it("returns the distinct questions of every questionnaire of the student", async () => {
    mocked.questionnaireQuestion.findMany.mockResolvedValueOnce([
      { questionId: 10, question: { statement: 'How do you learn?' } },
      { questionId: 11, question: { statement: 'Fallback statement' } },
    ]);

    const seen = await new QuestionnaireRepositoryImpl().findSeenQuestions(42);

    expect(seen).toEqual([
      { questionId: 10, statement: 'How do you learn?' },
      { questionId: 11, statement: 'Fallback statement' },
    ]);
    const query = mocked.questionnaireQuestion.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ questionnaire: { studentId: 42 } });
    expect(query.distinct).toEqual(['questionId']);
  });
});

describe('QuestionnaireRepositoryImpl progress (HU-29 S1)', () => {
  function makeTx(existing: Array<{ id: number; questionId: number }>, claimed = 1) {
    const rows = [
      { questionId: 10, selectedOptionId: 1, questionTimeSeconds: 2, numberOfChanges: 0, timesReviewed: 0 },
    ];
    return {
      questionnaire: { updateMany: jest.fn().mockResolvedValue({ count: claimed }) },
      answer: {
        findMany: jest.fn()
          .mockResolvedValueOnce(existing)
          .mockResolvedValueOnce(rows),
        update: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      option: { findMany: jest.fn().mockResolvedValue([]) },
      mLDataset: { create: jest.fn() },
    };
  }

  const answer = (questionId: number, selectedOptionId: number | null) => ({
    questionId, selectedOptionId, questionTimeSeconds: 2, numberOfChanges: 1, timesReviewed: 0,
  });

  it('saveProgress locks the in-progress questionnaire, updates saved answers and creates new ones', async () => {
    const tx = makeTx([{ id: 70, questionId: 10 }]);
    mocked.$transaction.mockImplementationOnce((fn: (t: typeof tx) => unknown) => fn(tx));

    const result = await new QuestionnaireRepositoryImpl().saveProgress(5, [answer(10, 1), answer(11, null)]);

    expect(tx.questionnaire.updateMany.mock.calls[0][0].where).toEqual({ id: 5, status: 'in_progress', deletedAt: null });
    expect(tx.answer.update).toHaveBeenCalledWith({
      where: { id: 70 },
      data: { selectedOptionId: 1, questionTimeSeconds: 2, numberOfChanges: 1, timesReviewed: 0 },
    });
    expect(tx.answer.create).toHaveBeenCalledWith({
      data: { questionnaireId: 5, questionId: 11, selectedOptionId: null, questionTimeSeconds: 2, numberOfChanges: 1, timesReviewed: 0 },
    });
    expect(result).toEqual([
      { questionId: 10, selectedOptionId: 1, questionTimeSeconds: 2, numberOfChanges: 0, timesReviewed: 0 },
    ]);
  });

  it('saveProgress soft-deletes duplicate saved rows of the same question', async () => {
    const tx = makeTx([{ id: 70, questionId: 10 }, { id: 71, questionId: 10 }]);
    mocked.$transaction.mockImplementationOnce((fn: (t: typeof tx) => unknown) => fn(tx));

    await new QuestionnaireRepositoryImpl().saveProgress(5, [answer(10, 1)]);

    expect(tx.answer.update).toHaveBeenCalledTimes(1);
    expect(tx.answer.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [71] } },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('saveProgress throws 409 when the questionnaire is no longer in progress', async () => {
    const tx = makeTx([], 0);
    mocked.$transaction.mockImplementationOnce((fn: (t: typeof tx) => unknown) => fn(tx));

    await expect(new QuestionnaireRepositoryImpl().saveProgress(5, [answer(10, 1)]))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(tx.answer.create).not.toHaveBeenCalled();
  });

  it('completion replaces progressively saved answers so none are duplicated', async () => {
    const tx = makeTx([]);
    mocked.$transaction.mockImplementationOnce((fn: (t: typeof tx) => unknown) => fn(tx));

    await new QuestionnaireRepositoryImpl().completeWithAnswersAndDataset({
      questionnaireId: 5,
      studentId: 42,
      completionPercentage: 100,
      answers: [{ ...answer(10, 1), navigationSequence: 1 }],
    });

    expect(tx.answer.deleteMany).toHaveBeenCalledWith({ where: { questionnaireId: 5 } });
    expect(tx.answer.deleteMany.mock.invocationCallOrder[0])
      .toBeLessThan(tx.answer.createMany.mock.invocationCallOrder[0]);
    expect(tx.questionnaire.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(tx.answer.deleteMany.mock.invocationCallOrder[0]);
  });
});
