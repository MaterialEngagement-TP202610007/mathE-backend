import { RevalidateQuestionUseCase } from '../../../../../src/domain/use-cases/question/revalidate-question.use-case.js';
import { QuestionEntity } from '../../../../../src/domain/entities/question.entity.js';
import { OptionEntity } from '../../../../../src/domain/entities/option.entity.js';
import { UserEntity } from '../../../../../src/domain/entities/user.entity.js';
import { QuestionRepository } from '../../../../../src/domain/repositories/question.repository.js';
import { UserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { ItemValidatorAdapter } from '../../../../../src/domain/adapters/item-validator.adapter.js';
import { SchoolAccessPolicy } from '../../../../../src/domain/policies/school-access.policy.js';
import { Requester } from '../../../../../src/domain/interfaces/shared/requester.interface.js';
import { ItemValidationBatch, ItemViolation } from '../../../../../src/domain/interfaces/item-validation/index.js';
import { CustomError } from '../../../../../src/domain/error/custom-error.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

const SCHOOL_A = 1;
const SCHOOL_B = 2;
const NOW = new Date('2026-10-02T12:00:00Z');

function makeQuestion(schoolId: number | null = SCHOOL_A): QuestionEntity {
  const options = [
    new OptionEntity(1, 5, 'Draw a diagram', 'V', NOW, NOW, null),
    new OptionEntity(2, 5, 'Say it aloud', 'A', NOW, NOW, null),
    new OptionEntity(3, 5, 'Build a model', 'K', NOW, NOW, null),
  ];
  return new QuestionEntity(
    5, 'How do you study fractions?', 'text', 'Visual', 'ai_generated', 'approved',
    NOW, NOW, NOW, 99, null, null, null, options, schoolId,
  );
}

function makeUser(id: number, roleId: number, schoolId: number | null): UserEntity {
  return new UserEntity(
    id, 'hash', `user${id}@example.com`, 'User', new Date('2000-01-01'),
    NOW, NOW, null, true, roleId, null, schoolId, null,
  );
}

const users = [makeUser(10, ROLES.TEACHER, SCHOOL_A), makeUser(20, ROLES.TEACHER, SCHOOL_B)];
const teacherA: Requester = { id: 10, roleId: ROLES.TEACHER };
const teacherB: Requester = { id: 20, roleId: ROLES.TEACHER };
const admin: Requester = { id: 1, roleId: ROLES.ADMIN };

function makePolicy(): SchoolAccessPolicy {
  const userRepo = {
    findById: jest.fn(async (id: number) => users.find((u) => u.id === id) ?? null),
  } as unknown as UserRepository;
  return new SchoolAccessPolicy(userRepo);
}

function makeRepo(question: QuestionEntity | null) {
  return {
    findById: jest.fn().mockResolvedValue(question),
    findBankStatements: jest.fn().mockResolvedValue(['Other statement']),
    updateMviValidation: jest.fn().mockImplementation(async (_id, data) => ({ ...question, ...data })),
  } as unknown as jest.Mocked<QuestionRepository>;
}

function makeValidator(batch?: ItemValidationBatch) {
  return {
    validate: jest.fn().mockResolvedValue(batch ?? { results: [{ approved: true, violations: [] }], catalogVersion: 'v1.2' }),
    wakeUp: jest.fn(),
    getCatalog: jest.fn(),
  } as unknown as jest.Mocked<ItemValidatorAdapter>;
}

const blocking: ItemViolation = {
  ruleId: 'R3', message: 'too long', measuredValue: 40, threshold: 30, severity: 'blocking',
};

function makeUseCase(repo: QuestionRepository, validator: ItemValidatorAdapter | null) {
  return new RevalidateQuestionUseCase(repo, makePolicy(), validator, { now: () => NOW });
}

describe('RevalidateQuestionUseCase', () => {
  it('returns 400 when MVI integration is disabled', async () => {
    const repo = makeRepo(makeQuestion());

    await expect(makeUseCase(repo, null).execute(5, admin)).rejects.toMatchObject({
      statusCode: 400,
      message: 'MVI integration is disabled',
    });
    expect(repo.updateMviValidation).not.toHaveBeenCalled();
  });

  it('returns 404 when the question does not exist', async () => {
    const repo = makeRepo(null);

    await expect(makeUseCase(repo, makeValidator()).execute(5, admin)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Question 5 not found',
    });
  });

  it('returns 403 for a teacher of another school and does not call MVI', async () => {
    const repo = makeRepo(makeQuestion(SCHOOL_A));
    const validator = makeValidator();

    await expect(makeUseCase(repo, validator).execute(5, teacherB)).rejects.toMatchObject({ statusCode: 403 });
    expect(validator.validate).not.toHaveBeenCalled();
    expect(repo.updateMviValidation).not.toHaveBeenCalled();
  });

  it('persists a passed diagnosis for an approved question without touching approval fields', async () => {
    const repo = makeRepo(makeQuestion());
    const validator = makeValidator();

    await makeUseCase(repo, validator).execute(5, teacherA);

    expect(repo.updateMviValidation).toHaveBeenCalledWith(5, {
      mviStatus: 'passed',
      mviResult: { approved: true, violations: [], attempts: 1 },
      mviCatalogVersion: 'v1.2',
      mviValidatedAt: NOW,
    });
    expect(repo.approve).toBeUndefined();
  });

  it('persists a failed diagnosis with its violations', async () => {
    const repo = makeRepo(makeQuestion());
    const validator = makeValidator({ results: [{ approved: false, violations: [blocking] }], catalogVersion: 'v1.3' });

    const updated = await makeUseCase(repo, validator).execute(5, admin);

    expect(repo.updateMviValidation).toHaveBeenCalledWith(5, {
      mviStatus: 'failed',
      mviResult: { approved: false, violations: [blocking], attempts: 1 },
      mviCatalogVersion: 'v1.3',
      mviValidatedAt: NOW,
    });
    expect(updated.mviStatus).toBe('failed');
  });

  it('sends the question and a bank that excludes itself', async () => {
    const repo = makeRepo(makeQuestion());
    const validator = makeValidator();

    await makeUseCase(repo, validator).execute(5, admin);

    expect(repo.findBankStatements).toHaveBeenCalledWith(SCHOOL_A, 5);
    expect(validator.validate).toHaveBeenCalledWith(
      [{
        id: '5',
        statement: 'How do you study fractions?',
        vakStyle: 'Visual',
        options: [
          { text: 'Draw a diagram', vakValue: 'V' },
          { text: 'Say it aloud', vakValue: 'A' },
          { text: 'Build a model', vakValue: 'K' },
        ],
      }],
      ['Other statement'],
    );
  });

  it('uses an empty bank for questions without a school', async () => {
    const repo = makeRepo(makeQuestion(null));
    const validator = makeValidator();

    await makeUseCase(repo, validator).execute(5, admin);

    expect(repo.findBankStatements).not.toHaveBeenCalled();
    expect(validator.validate.mock.calls[0][1]).toEqual([]);
  });

  it('propagates validator errors and persists nothing', async () => {
    const repo = makeRepo(makeQuestion());
    const validator = makeValidator();
    validator.validate.mockRejectedValueOnce(CustomError.serviceUnavailable('MVI unreachable'));

    await expect(makeUseCase(repo, validator).execute(5, admin)).rejects.toMatchObject({ statusCode: 503 });
    expect(repo.updateMviValidation).not.toHaveBeenCalled();
  });

  it('returns 502 when MVI answers without a result', async () => {
    const repo = makeRepo(makeQuestion());
    const validator = makeValidator({ results: [], catalogVersion: 'v1.2' });

    await expect(makeUseCase(repo, validator).execute(5, admin)).rejects.toMatchObject({
      statusCode: 502,
      message: 'MVI returned no result',
    });
    expect(repo.updateMviValidation).not.toHaveBeenCalled();
  });
});
