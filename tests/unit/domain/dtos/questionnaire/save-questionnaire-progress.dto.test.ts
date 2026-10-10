import { SaveQuestionnaireProgressDto } from '../../../../../src/domain/dtos/questionnaire/save-questionnaire-progress.dto.js';

describe('SaveQuestionnaireProgressDto', () => {
  it('parses one or more answers with behaviour fields defaulting to 0', () => {
    const [error, dto] = SaveQuestionnaireProgressDto.create({
      answers: [
        { questionId: '5', selectedOptionId: 51, questionTimeSeconds: 4.5, numberOfChanges: 1, timesReviewed: 2 },
        { questionId: 6, selectedOptionId: null },
      ],
    });

    expect(error).toBeUndefined();
    expect(dto!.answers).toEqual([
      { questionId: 5, selectedOptionId: 51, questionTimeSeconds: 4.5, numberOfChanges: 1, timesReviewed: 2 },
      { questionId: 6, selectedOptionId: null, questionTimeSeconds: 0, numberOfChanges: 0, timesReviewed: 0 },
    ]);
  });

  it.each([
    [{}, 'answers must be an array of 1 to 10 items'],
    [{ answers: [] }, 'answers must be an array of 1 to 10 items'],
    [{ answers: Array.from({ length: 11 }, (_, i) => ({ questionId: i + 1, selectedOptionId: 1 })) }, 'answers must be an array of 1 to 10 items'],
    [{ answers: [{ selectedOptionId: 1 }] }, 'answers[0].questionId is required and must be a number'],
    [{ answers: [{ questionId: 1, selectedOptionId: 'x' }] }, 'answers[0].selectedOptionId must be a number or null'],
    [{ answers: [{ questionId: 1, selectedOptionId: 1, questionTimeSeconds: -1 }] }, 'answers[0].questionTimeSeconds must be a non-negative number'],
  ])('rejects %j', (body, message) => {
    const [error, dto] = SaveQuestionnaireProgressDto.create(body);

    expect(error).toBe(message);
    expect(dto).toBeUndefined();
  });
});
