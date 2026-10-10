import { ApproveQuestionUseCase } from '../../../../../src/domain/use-cases/question/approve-question.use-case.js';
import { QuestionEntity } from '../../../../../src/domain/entities/question.entity.js';
import { QuestionRepository } from '../../../../../src/domain/repositories/question.repository.js';
import { SchoolAccessPolicy } from '../../../../../src/domain/policies/school-access.policy.js';
import { Requester } from '../../../../../src/domain/interfaces/shared/requester.interface.js';
import { ROLES } from '../../../../../src/domain/constants/roles.constant.js';
import { ApproveQuestionDto } from '../../../../../src/domain/dtos/question/approve-question.dto.js';
import { OptionEntity } from '../../../../../src/domain/entities/option.entity.js';

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

describe('ApproveQuestionUseCase style must match the option distribution (HU-42 vs HU-20)', () => {
  function dto(body: object): ApproveQuestionDto {
    const [, approveDto] = ApproveQuestionDto.create(body);
    return approveDto!;
  }

  function withOptions(values: string[]): QuestionEntity {
    const q = makeQuestion('passed');
    q.options = values.map((vakValue, i) =>
      new OptionEntity(i + 1, 5, `Option ${i + 1}`, vakValue, new Date(), new Date(), null),
    );
    return q;
  }

  it('accepts the style whose label appears twice among the options', async () => {
    const { repo, useCase } = makeUseCase(withOptions(['K', 'V', 'K', 'A']));

    await useCase.execute(5, admin, dto({ vakStyle: 'Kinesthetic' }));

    expect(repo.approve).toHaveBeenCalledWith(5, { approvedOverMvi: false, vakStyle: 'Kinesthetic' });
  });

  it('rejects a style that differs from the doubled option label with a 400', async () => {
    const { repo, useCase } = makeUseCase(withOptions(['V', 'A', 'K', 'V']));

    const promise = useCase.execute(5, admin, dto({ vakStyle: 'Auditory' }));

    await expect(promise).rejects.toMatchObject({ statusCode: 400 });
    await expect(promise).rejects.toThrow(/Visual/);
    expect(repo.approve).not.toHaveBeenCalled();
  });

  it('accepts the teacher style when the options have no clear doubled label (legacy data)', async () => {
    const { repo, useCase } = makeUseCase(withOptions(['V', 'A', 'K']));

    await useCase.execute(5, admin, dto({ vakStyle: 'Auditory' }));

    expect(repo.approve).toHaveBeenCalledWith(5, { approvedOverMvi: false, vakStyle: 'Auditory' });
  });

  it('keeps the current behaviour without a body even if the distribution differs', async () => {
    const { repo, useCase } = makeUseCase(withOptions(['A', 'A', 'V', 'K']));

    await useCase.execute(5, admin);

    expect(repo.approve).toHaveBeenCalledWith(5, { approvedOverMvi: false, vakStyle: null });
  });
});
