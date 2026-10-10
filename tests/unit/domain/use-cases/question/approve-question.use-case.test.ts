import { ApproveQuestionUseCase } from '../../../../../src/domain/use-cases/question/approve-question.use-case.js';
import { QuestionEntity } from '../../../../../src/domain/entities/question.entity.js';
import { QuestionRepository } from '../../../../../src/domain/repositories/question.repository.js';
import { SchoolAccessPolicy } from '../../../../../src/domain/policies/school-access.policy.js';
import { Requester } from '../../../../../src/domain/interfaces/shared/requester.interface.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';
import { ApproveQuestionDto } from '../../../../../src/domain/dtos/question/approve-question.dto.js';

const admin: Requester = { id: 1, roleId: ROLES.ADMIN };

function makeQuestion(mviStatus: string | null, validationStatus = 'pending'): QuestionEntity {
  const q = new QuestionEntity(
    5, 'Statement', 'text', 'Visual', 'ai_generated', validationStatus,
    new Date(), new Date(), new Date(), 99, null, null, null, [], 1,
  );
  q.mviStatus = mviStatus;
  return q;
}

function makeUseCase(question: QuestionEntity) {
  const repo = {
    findById: jest.fn().mockResolvedValue(question),
    approve: jest.fn().mockResolvedValue(question),
  } as unknown as jest.Mocked<QuestionRepository>;
  const policy = { assertCanManageQuestion: jest.fn().mockResolvedValue(undefined) } as unknown as SchoolAccessPolicy;
  return { repo, useCase: new ApproveQuestionUseCase(repo, policy) };
}

describe('ApproveQuestionUseCase MVI override flag', () => {
  it('flags the approval when the MVI diagnosis failed', async () => {
    const { repo, useCase } = makeUseCase(makeQuestion('failed'));

    await useCase.execute(5, admin);

    expect(repo.approve).toHaveBeenCalledWith(5, { approvedOverMvi: true, vakStyle: null });
  });

  it.each(['passed', 'unavailable', 'skipped', null])(
    'does not flag the approval when mviStatus is %s',
    async (status) => {
      const { repo, useCase } = makeUseCase(makeQuestion(status));

      await useCase.execute(5, admin);

      expect(repo.approve).toHaveBeenCalledWith(5, { approvedOverMvi: false, vakStyle: null });
    },
  );

  it('still rejects questions that are not pending', async () => {
    const { repo, useCase } = makeUseCase(makeQuestion('failed', 'approved'));

    await expect(useCase.execute(5, admin)).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.approve).not.toHaveBeenCalled();
  });
});

describe('ApproveQuestionUseCase VAK style (HU-42)', () => {
  function dto(body: object): ApproveQuestionDto {
    const [, approveDto] = ApproveQuestionDto.create(body);
    return approveDto!;
  }

  it('approves with the style the teacher selected', async () => {
    const { repo, useCase } = makeUseCase(makeQuestion('passed'));

    await useCase.execute(5, admin, dto({ vakStyle: 'Kinesthetic' }));

    expect(repo.approve).toHaveBeenCalledWith(5, { approvedOverMvi: false, vakStyle: 'Kinesthetic' });
  });

  it('keeps the MVI override flag when a style is selected', async () => {
    const { repo, useCase } = makeUseCase(makeQuestion('failed'));

    await useCase.execute(5, admin, dto({ vakStyle: 'Auditory' }));

    expect(repo.approve).toHaveBeenCalledWith(5, { approvedOverMvi: true, vakStyle: 'Auditory' });
  });

  it('keeps the current style when none is selected', async () => {
    const { repo, useCase } = makeUseCase(makeQuestion(null));

    await useCase.execute(5, admin, dto({}));

    expect(repo.approve).toHaveBeenCalledWith(5, { approvedOverMvi: false, vakStyle: null });
  });
});
