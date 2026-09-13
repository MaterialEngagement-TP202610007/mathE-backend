jest.mock('../../../../src/config/database/index.js', () => ({
  prisma: {
    questionnaire: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '../../../../src/config/database/index.js';
import { QuestionnaireRepositoryImpl } from '../../../../src/infrastructure/repositories/questionnaire.repository.impl.js';

const mocked = prisma as unknown as {
  questionnaire: { findFirst: jest.Mock };
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
    });

    const result = await new QuestionnaireRepositoryImpl().findActiveWithQuestions(42);

    expectNoVakLeak(result!.questions);
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
