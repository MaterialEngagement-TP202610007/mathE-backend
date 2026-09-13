import { ApproveQuestionUseCase } from '../../../../../src/domain/use-cases/question/approve-question.use-case.js';
import { RejectQuestionUseCase } from '../../../../../src/domain/use-cases/question/reject-question.use-case.js';
import { GetQuestionUseCase } from '../../../../../src/domain/use-cases/question/get-question.use-case.js';
import { DeleteQuestionUseCase } from '../../../../../src/domain/use-cases/question/delete-question.use-case.js';
import { RejectQuestionDto } from '../../../../../src/domain/dtos/question/reject-question.dto.js';
import { QuestionEntity } from '../../../../../src/domain/entities/question.entity.js';
import { UserEntity } from '../../../../../src/domain/entities/user.entity.js';
import { QuestionRepository } from '../../../../../src/domain/repositories/question.repository.js';
import { UserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { SchoolAccessPolicy } from '../../../../../src/domain/policies/school-access.policy.js';
import { Requester } from '../../../../../src/domain/interfaces/shared/requester.interface.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';

const SCHOOL_A = 1;
const SCHOOL_B = 2;

function makeQuestion(schoolId: number | null): QuestionEntity {
  return new QuestionEntity(
    5, 'Statement', 'text', 'Visual', 'ai_generated', 'pending',
    new Date(), new Date(), new Date(), 99, null, null, null, [], schoolId,
  );
}

function makeUser(id: number, roleId: number, schoolId: number | null): UserEntity {
  return new UserEntity(
    id, 'hash', `user${id}@example.com`, 'User', new Date('2000-01-01'),
    new Date(), new Date(), null, true, roleId, null, schoolId, null,
  );
}

const users = [makeUser(10, ROLES.TEACHER, SCHOOL_A), makeUser(20, ROLES.TEACHER, SCHOOL_B)];
const teacherA: Requester = { id: 10, roleId: ROLES.TEACHER };
const teacherB: Requester = { id: 20, roleId: ROLES.TEACHER };
const admin: Requester = { id: 1, roleId: ROLES.ADMIN };

function makeRepo(question: QuestionEntity | null): jest.Mocked<QuestionRepository> {
  return {
    findById: jest.fn().mockResolvedValue(question),
    approve: jest.fn().mockResolvedValue(question),
    reject: jest.fn().mockResolvedValue(question),
    softDelete: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<QuestionRepository>;
}

function makePolicy(): SchoolAccessPolicy {
  const userRepo = {
    findById: jest.fn(async (id: number) => users.find((u) => u.id === id) ?? null),
  } as unknown as UserRepository;
  return new SchoolAccessPolicy(userRepo);
}

const [, rejectDto] = RejectQuestionDto.create({ rejectionReason: 'Not clear' });

type Scenario = {
  name: string;
  run: (repo: QuestionRepository, requester: Requester) => Promise<unknown>;
  mutation: keyof QuestionRepository | null;
};

const scenarios: Scenario[] = [
  { name: 'approve', run: (r, req) => new ApproveQuestionUseCase(r, makePolicy()).execute(5, req), mutation: 'approve' },
  { name: 'reject', run: (r, req) => new RejectQuestionUseCase(r, makePolicy()).execute(5, rejectDto!, req), mutation: 'reject' },
  { name: 'delete', run: (r, req) => new DeleteQuestionUseCase(r, makePolicy()).execute(5, req), mutation: 'softDelete' },
  { name: 'getById', run: (r, req) => new GetQuestionUseCase(r, makePolicy()).execute(5, req), mutation: null },
];

describe.each(scenarios)('$name question with school scope', ({ run, mutation }) => {
  it('allows a teacher of the question school', async () => {
    const repo = makeRepo(makeQuestion(SCHOOL_A));

    await run(repo, teacherA);

    if (mutation) expect(repo[mutation]).toHaveBeenCalled();
  });

  it('returns 403 for a teacher of another school and does not mutate', async () => {
    const repo = makeRepo(makeQuestion(SCHOOL_A));

    await expect(run(repo, teacherB)).rejects.toMatchObject({
      statusCode: 403,
      message: 'Question does not belong to your school',
    });
    if (mutation) expect(repo[mutation]).not.toHaveBeenCalled();
  });

  it('allows an admin on any school question', async () => {
    const repo = makeRepo(makeQuestion(SCHOOL_B));

    await run(repo, admin);

    if (mutation) expect(repo[mutation]).toHaveBeenCalled();
  });

  it('returns 404 when the question does not exist', async () => {
    const repo = makeRepo(null);

    await expect(run(repo, admin)).rejects.toMatchObject({ statusCode: 404 });
  });
});
