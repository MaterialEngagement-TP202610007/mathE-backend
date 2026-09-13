jest.mock('../../../../src/config/database/index.js', () => ({
  prisma: {
    question: { findMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '../../../../src/config/database/index.js';
import { QuestionRepositoryImpl } from '../../../../src/infrastructure/repositories/question.repository.impl.js';

const mocked = prisma as unknown as {
  question: { findMany: jest.Mock; create: jest.Mock };
  $transaction: jest.Mock;
};

function dbQuestion(id: number) {
  return {
    id,
    statement: `Q${id}`,
    contentType: 'text',
    mediaUrl: null,
    vakStyle: 'Visual',
    options: [{ id: id * 10, questionId: id, text: 'opt', vakValue: 'V', deletedAt: null }],
  };
}

describe('QuestionRepositoryImpl.findApprovedByStyle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mocked.question.findMany.mockReset();
  });

  it('only considers approved, AI-generated, non-deleted questions of the given school', async () => {
    mocked.question.findMany
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockImplementationOnce(async ({ where }) => where.id.in.map(dbQuestion));

    await new QuestionRepositoryImpl().findApprovedByStyle('Visual', 2, 7);

    expect(mocked.question.findMany.mock.calls[0][0].where).toEqual({
      vakStyle: 'Visual',
      validationStatus: 'approved',
      origin: 'ai_generated',
      deletedAt: null,
      schoolId: 7,
    });
  });

  it('samples from the whole candidate pool, not only the oldest ids', async () => {
    const candidates = Array.from({ length: 30 }, (_, i) => ({ id: i + 1 }));
    const repo = new QuestionRepositoryImpl();
    const seen = new Set<number>();

    for (let run = 0; run < 20; run++) {
      mocked.question.findMany
        .mockResolvedValueOnce(candidates)
        .mockImplementationOnce(async ({ where }) => where.id.in.map(dbQuestion));
      const result = await repo.findApprovedByStyle('Visual', 3, 7);
      expect(result).toHaveLength(3);
      result.forEach((q) => seen.add(q.id));
    }

    // Candidate query is unbounded (no take/orderBy), so any id can be picked.
    const candidateQuery = mocked.question.findMany.mock.calls[0][0];
    expect(candidateQuery).not.toHaveProperty('take');
    expect(candidateQuery).not.toHaveProperty('orderBy');
    // The previous implementation could only ever return ids 1..9 (take: limit * 3).
    expect([...seen].some((id) => id > 9)).toBe(true);
  });

  it('returns the picked questions in the sampled order', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    mocked.question.findMany
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }])
      .mockResolvedValueOnce([dbQuestion(1), dbQuestion(2), dbQuestion(3)]);

    const result = await new QuestionRepositoryImpl().findApprovedByStyle('Visual', 3, 7);

    const sampled = mocked.question.findMany.mock.calls[1][0].where.id.in;
    expect(result.map((q) => q.id)).toEqual(sampled);
  });

  it('never exposes vakValue on options', async () => {
    mocked.question.findMany
      .mockResolvedValueOnce([{ id: 1 }])
      .mockImplementationOnce(async ({ where }) => where.id.in.map(dbQuestion));

    const [question] = await new QuestionRepositoryImpl().findApprovedByStyle('Visual', 1, 7);

    expect(question).not.toHaveProperty('vakStyle');
    expect(question.options[0]).toEqual({ id: 10, text: 'opt' });
  });

  it('does not load questions when the school has no candidates', async () => {
    mocked.question.findMany.mockResolvedValueOnce([]);

    const result = await new QuestionRepositoryImpl().findApprovedByStyle('Visual', 4, 7);

    expect(result).toEqual([]);
    expect(mocked.question.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('QuestionRepositoryImpl school-scoped writes and reads', () => {
  it('scopes recent statements to the school', async () => {
    mocked.question.findMany.mockResolvedValueOnce([{ statement: 'A' }]);

    await expect(
      new QuestionRepositoryImpl().findRecentStatementsByVakStyle('Auditory', 20, 7),
    ).resolves.toEqual(['A']);

    expect(mocked.question.findMany.mock.calls[0][0].where).toEqual({
      vakStyle: 'Auditory',
      deletedAt: null,
      schoolId: 7,
    });
  });

  it('persists the schoolId of a generated question', async () => {
    const created = { ...dbQuestion(5), origin: 'ai_generated', validationStatus: 'pending', schoolId: 7 };
    mocked.question.create.mockResolvedValueOnce(created);
    mocked.$transaction.mockImplementationOnce(async (fn) => fn(mocked));

    const entity = await new QuestionRepositoryImpl().createWithOptionsAndEmbedding({
      statement: 'Q5', vakStyle: 'Visual', contentType: 'text', origin: 'ai_generated',
      validationStatus: 'pending', generationDate: new Date(), teacherId: 2, schoolId: 7,
      options: [], embeddingVector: null, embeddingModelVersion: 'v1',
    });

    expect(mocked.question.create.mock.calls[0][0].data.schoolId).toBe(7);
    expect(entity.schoolId).toBe(7);
  });
});
