export interface AnswerInput {
  questionId: number;
  selectedOptionId: number | null;
  questionTimeSeconds: number;
  numberOfChanges: number;
  timesReviewed: number;
}

export class CompleteQuestionnaireDto {
  private constructor(
    public completionPercentage: number,
    public answers: AnswerInput[],
  ) {}

  static create(object: { [key: string]: any }): [string?, CompleteQuestionnaireDto?] {
    const { completionPercentage, answers } = object;

    if (completionPercentage === undefined || completionPercentage === null)
      return ["completionPercentage is required"];
    const cp = Number(completionPercentage);
    if (isNaN(cp) || cp < 0 || cp > 100)
      return ["completionPercentage must be a number between 0 and 100"];

    if (!Array.isArray(answers) || answers.length !== 10)
      return ["answers must be an array of exactly 10 items"];

    const parsedAnswers: AnswerInput[] = [];
    for (let i = 0; i < answers.length; i++) {
      const a = answers[i];

      if (!a.questionId || isNaN(Number(a.questionId)))
        return [`answers[${i}].questionId is required and must be a number`];

      const selectedOptionId =
        a.selectedOptionId !== undefined && a.selectedOptionId !== null
          ? Number(a.selectedOptionId)
          : null;
      if (selectedOptionId !== null && isNaN(selectedOptionId))
        return [`answers[${i}].selectedOptionId must be a number or null`];

      const questionTimeSeconds = Number(a.questionTimeSeconds ?? 0);
      if (isNaN(questionTimeSeconds) || questionTimeSeconds < 0)
        return [`answers[${i}].questionTimeSeconds must be a non-negative number`];

      const numberOfChanges = Number(a.numberOfChanges ?? 0);
      if (isNaN(numberOfChanges) || numberOfChanges < 0)
        return [`answers[${i}].numberOfChanges must be a non-negative integer`];

      const timesReviewed = Number(a.timesReviewed ?? 0);
      if (isNaN(timesReviewed) || timesReviewed < 0)
        return [`answers[${i}].timesReviewed must be a non-negative integer`];

      parsedAnswers.push({
        questionId: Number(a.questionId),
        selectedOptionId,
        questionTimeSeconds,
        numberOfChanges,
        timesReviewed,
      });
    }

    return [undefined, new CompleteQuestionnaireDto(cp, parsedAnswers)];
  }
}
