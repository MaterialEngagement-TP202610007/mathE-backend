import { CompleteQuestionnaireUseCase } from '../../../../../src/domain/use-cases/questionnaire/complete-questionnaire.use-case.js';
import { CompleteQuestionnaireDto } from '../../../../../src/domain/dtos/questionnaire/complete-questionnaire.dto.js';
import { QuestionnaireRepository } from '../../../../../src/domain/repositories/questionnaire.repository.js';
import { MLDatasetRepository } from '../../../../../src/domain/repositories/ml-dataset.repository.js';
import { MLModelRepository } from '../../../../../src/domain/repositories/ml-model.repository.js';
import { ResultRepository } from '../../../../../src/domain/repositories/result.repository.js';
import { LambdaClassifierAdapter } from '../../../../../src/domain/adapters/lambda-classifier.adapter.js';
import { VakFeedbackAdapter } from '../../../../../src/domain/adapters/vak-feedback.adapter.js';
import { QuestionnaireEntity } from '../../../../../src/domain/entities/questionnaire.entity.js';
import { ResultEntity } from '../../../../../src/domain/entities/result.entity.js';
import { MLDatasetEntity } from '../../../../../src/domain/entities/ml-dataset.entity.js';
import { MLModelEntity } from '../../../../../src/domain/entities/ml-model.entity.js';
import { LambdaClassifierOutput } from '../../../../../src/domain/interfaces/result/index.js';
import { CustomError } from '../../../../../src/domain/error/custom-error.js';

const QUESTIONNAIRE_ID = 10;
const STUDENT_ID = 3;

// Questions 101..110, each with options (questionId * 10 + 1..3)
const QUESTION_OPTIONS = Array.from({ length: 10 }, (_, i) => {
  const questionId = 101 + i;
  return {
    questionId,
    optionIds: [questionId * 10 + 1, questionId * 10 + 2, questionId * 10 + 3],
  };
});

function makeDto(overrides: Array<Partial<{ questionId: number; selectedOptionId: number | null }>> = []) {
  const answers = QUESTION_OPTIONS.map((q, i) => ({
    questionId: q.questionId,
    selectedOptionId: q.optionIds[0],
    questionTimeSeconds: 5,
    numberOfChanges: 0,
    timesReviewed: 0,
    ...(overrides[i] ?? {}),
  }));
  const [err, dto] = CompleteQuestionnaireDto.create({ completionPercentage: 100, answers });
  if (err) throw new Error(err);
  return dto!;
}

function makeQuestionnaire(status: string, studentId = STUDENT_ID): QuestionnaireEntity {
  return new QuestionnaireEntity(
    QUESTIONNAIRE_ID, studentId, status, new Date(), new Date(), new Date(),
    null, false, null, null,
  );
}

function makeResult(overrides: Partial<ResultEntity> = {}): ResultEntity {
  return Object.assign(
    new ResultEntity(
      77, QUESTIONNAIRE_ID, STUDENT_ID, null, 'Visual', 'Auditory',
      60, 30, 10, 60, 'tendency', false, 'simple_score', null,
      'Existing feedback', 'gemini', new Date(), new Date(),
    ),
    overrides,
  );
}

const TX_FEATURES = {
  visualScore: 6,
  auditoryScore: 3,
  kinestheticScore: 1,
  responseConsistency: 0.4,
  avgQuestionTime: 5,
  totalChanges: 0,
  totalReviews: 0,
  vakLabel: 'Visual',
};

const LAMBDA_OUTPUT: LambdaClassifierOutput = {
  predominantStyle: 'Kinesthetic',
  secondaryStyle: 'Visual',
  visualProbability: 20,
  auditoryProbability: 10,
  kinestheticProbability: 70,
  predominantConfidence: 70,
  profileType: 'clear',
  isMixedProfile: false,
  classifierType: 'xgboost',
};

function makeQuestionnaireRepo(): jest.Mocked<QuestionnaireRepository> {
  return {
    createWithQuestions: jest.fn(),
    findById: jest.fn(),
    findInProgressByStudent: jest.fn(),
    findActiveWithQuestions: jest.fn(),
    findByStudent: jest.fn(),
    findQuestionOptions: jest.fn().mockResolvedValue(QUESTION_OPTIONS),
    completeWithAnswersAndDataset: jest.fn().mockResolvedValue(TX_FEATURES),
    abandon: jest.fn(),
  } as unknown as jest.Mocked<QuestionnaireRepository>;
}

function makeMlDatasetRepo(): jest.Mocked<MLDatasetRepository> {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByQuestionnaire: jest.fn(),
  } as unknown as jest.Mocked<MLDatasetRepository>;
}

function makeMlModelRepo(): jest.Mocked<MLModelRepository> {
  return {
    findActive: jest.fn().mockResolvedValue(
      new MLModelEntity(5, '1.2.0', 's3://model', 'xgboost', true, new Date(), new Date()),
    ),
  } as unknown as jest.Mocked<MLModelRepository>;
}

function makeResultRepo(): jest.Mocked<ResultRepository> {
  return {
    saveWithNotification: jest.fn().mockImplementation(async () => makeResult({ id: 99 })),
    findByQuestionnaire: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<ResultRepository>;
}

describe('CompleteQuestionnaireUseCase', () => {
  let questionnaireRepo: jest.Mocked<QuestionnaireRepository>;
  let mlDatasetRepo: jest.Mocked<MLDatasetRepository>;
  let mlModelRepo: jest.Mocked<MLModelRepository>;
  let resultRepo: jest.Mocked<ResultRepository>;
  let lambda: jest.Mocked<LambdaClassifierAdapter>;
  let feedback: jest.Mocked<VakFeedbackAdapter>;
  let useCase: CompleteQuestionnaireUseCase;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    questionnaireRepo = makeQuestionnaireRepo();
    mlDatasetRepo = makeMlDatasetRepo();
    mlModelRepo = makeMlModelRepo();
    resultRepo = makeResultRepo();
    lambda = { classify: jest.fn().mockResolvedValue(LAMBDA_OUTPUT) } as jest.Mocked<LambdaClassifierAdapter>;
    feedback = { generateFeedback: jest.fn().mockResolvedValue('AI feedback') } as jest.Mocked<VakFeedbackAdapter>;
    useCase = new CompleteQuestionnaireUseCase(
      questionnaireRepo, mlDatasetRepo, mlModelRepo, resultRepo, lambda, feedback,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('completes a fresh questionnaire with the Lambda classification and Gemini feedback', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('in_progress'));

    const result = await useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto());

    expect(questionnaireRepo.completeWithAnswersAndDataset).toHaveBeenCalledTimes(1);
    expect(lambda.classify).toHaveBeenCalledWith({
      features: {
        visual_score: 6,
        auditory_score: 3,
        kinesthetic_score: 1,
        response_consistency: 0.4,
        avg_response_time: 5,
        total_changes: 0,
        total_backtracks: 0,
      },
    });
    expect(resultRepo.saveWithNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        questionnaireId: QUESTIONNAIRE_ID,
        studentId: STUDENT_ID,
        predominantStyle: 'Kinesthetic',
        classifierType: 'xgboost',
        mlModelId: 5,
        modelVersion: '1.2.0',
        aiFeedback: 'AI feedback',
        feedbackSource: 'gemini',
      }),
    );
    expect(result).toEqual({
      resultId: 99,
      predominantStyle: 'Kinesthetic',
      secondaryStyle: 'Visual',
      visualProbability: 20,
      auditoryProbability: 10,
      kinestheticProbability: 70,
      predominantConfidence: 70,
      profileType: 'clear',
      isMixedProfile: false,
      classifierType: 'xgboost',
      aiFeedback: 'AI feedback',
      feedbackSource: 'gemini',
    });
  });

  it('returns the existing result when the questionnaire is already completed with a result', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('completed'));
    resultRepo.findByQuestionnaire.mockResolvedValueOnce(makeResult());

    const result = await useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto());

    expect(result).toEqual({
      resultId: 77,
      predominantStyle: 'Visual',
      secondaryStyle: 'Auditory',
      visualProbability: 60,
      auditoryProbability: 30,
      kinestheticProbability: 10,
      predominantConfidence: 60,
      profileType: 'tendency',
      isMixedProfile: false,
      classifierType: 'simple_score',
      aiFeedback: 'Existing feedback',
      feedbackSource: 'gemini',
    });
    expect(questionnaireRepo.completeWithAnswersAndDataset).not.toHaveBeenCalled();
    expect(lambda.classify).not.toHaveBeenCalled();
    expect(resultRepo.saveWithNotification).not.toHaveBeenCalled();
  });

  it('resumes classification from the persisted dataset when completed without a result', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('completed'));
    mlDatasetRepo.findByQuestionnaire.mockResolvedValueOnce(
      new MLDatasetEntity(
        1, QUESTIONNAIRE_ID, STUDENT_ID, 2, 7, 1, 0.55, 4.5, 3, 2, 100,
        'Auditory', 'simple_score', false, new Date(), new Date(),
      ),
    );

    const result = await useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto());

    expect(questionnaireRepo.completeWithAnswersAndDataset).not.toHaveBeenCalled();
    expect(lambda.classify).toHaveBeenCalledWith({
      features: {
        visual_score: 2,
        auditory_score: 7,
        kinesthetic_score: 1,
        response_consistency: 0.55,
        avg_response_time: 4.5,
        total_changes: 3,
        total_backtracks: 2,
      },
    });
    expect(resultRepo.saveWithNotification).toHaveBeenCalledTimes(1);
    expect(result.resultId).toBe(99);
    expect(result.classifierType).toBe('xgboost');
  });

  it('throws 409 when completed without a result and no persisted dataset exists', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('completed'));
    mlDatasetRepo.findByQuestionnaire.mockResolvedValueOnce(null);

    await expect(
      useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto()),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('returns the concurrently saved result when saving the result fails', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('in_progress'));
    resultRepo.saveWithNotification.mockRejectedValueOnce(new Error('unique constraint'));
    resultRepo.findByQuestionnaire.mockResolvedValueOnce(makeResult());

    const result = await useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto());

    expect(result.resultId).toBe(77);
  });

  it('rethrows the save error when no result exists afterwards', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('in_progress'));
    const saveError = new Error('db down');
    resultRepo.saveWithNotification.mockRejectedValueOnce(saveError);
    resultRepo.findByQuestionnaire.mockResolvedValueOnce(null);

    await expect(
      useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto()),
    ).rejects.toBe(saveError);
  });

  it('falls back to simple_score when the Lambda classifier throws', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('in_progress'));
    lambda.classify.mockRejectedValueOnce(CustomError.gatewayTimeout('Lambda timed out'));

    const result = await useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto());

    expect(result.classifierType).toBe('simple_score');
    expect(result.predominantStyle).toBe('Visual');
    expect(result.secondaryStyle).toBe('Auditory');
    expect(result.visualProbability).toBeCloseTo(60);
    expect(result.auditoryProbability).toBeCloseTo(30);
    expect(result.kinestheticProbability).toBeCloseTo(10);
    expect(resultRepo.saveWithNotification).toHaveBeenCalledWith(
      expect.objectContaining({ mlModelId: null, modelVersion: null }),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Lambda'),
      'Lambda timed out',
    );
  });

  it('falls back to predefined feedback when Gemini feedback throws', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('in_progress'));
    feedback.generateFeedback.mockRejectedValueOnce(new Error('Gemini down'));

    const result = await useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto());

    expect(result.feedbackSource).toBe('predefined');
    expect(result.aiFeedback).toContain('Kinestésico');
  });

  it('throws 404 when the questionnaire does not exist', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when the questionnaire belongs to another student', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('in_progress', 999));

    await expect(
      useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto()),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(questionnaireRepo.completeWithAnswersAndDataset).not.toHaveBeenCalled();
  });

  it('throws 403 for another student even when the questionnaire is completed', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('completed', 999));

    await expect(
      useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto()),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(resultRepo.findByQuestionnaire).not.toHaveBeenCalled();
  });

  it('throws 400 when the questionnaire is abandoned', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('abandoned'));

    await expect(
      useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto()),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(questionnaireRepo.completeWithAnswersAndDataset).not.toHaveBeenCalled();
  });

  it('throws 400 when an answer references a question outside the questionnaire', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('in_progress'));

    await expect(
      useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto([{ questionId: 5555, selectedOptionId: null }])),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(questionnaireRepo.completeWithAnswersAndDataset).not.toHaveBeenCalled();
  });

  it('throws 400 when a selected option does not belong to its question', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('in_progress'));

    await expect(
      useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto([{ selectedOptionId: 1021 }])),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(questionnaireRepo.completeWithAnswersAndDataset).not.toHaveBeenCalled();
  });

  it('throws 400 when the same question is answered twice', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('in_progress'));

    await expect(
      useCase.execute(
        QUESTIONNAIRE_ID,
        STUDENT_ID,
        makeDto([{}, { questionId: 101, selectedOptionId: 1011 }]),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('accepts null selectedOptionId for skipped questions', async () => {
    questionnaireRepo.findById.mockResolvedValueOnce(makeQuestionnaire('in_progress'));

    await expect(
      useCase.execute(QUESTIONNAIRE_ID, STUDENT_ID, makeDto([{ selectedOptionId: null }])),
    ).resolves.toMatchObject({ resultId: 99 });
  });
});
