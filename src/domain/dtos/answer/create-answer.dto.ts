export class CreateAnswerDto {
  private constructor(
    public questionnaireId: number,
    public questionId: number,
    public selectedOptionId: number | null,
    public navigationSequence: number | null,
    public questionTimeSeconds: number | null,
    public numberOfChanges: number | null,
    public numberOfClicks: number | null,
    public timesReviewed: number | null,
  ) {}

  static create(object: { [key: string]: any }): [string?, CreateAnswerDto?] {
    const {
      questionnaireId,
      questionId,
      selectedOptionId,
      navigationSequence,
      questionTimeSeconds,
      numberOfChanges,
      numberOfClicks,
      timesReviewed,
    } = object;

    if (!questionnaireId || isNaN(Number(questionnaireId)))
      return ["Missing or invalid questionnaireId"];
    if (!questionId || isNaN(Number(questionId)))
      return ["Missing or invalid questionId"];

    const toNumOrNull = (v: any) =>
      v !== undefined && v !== null && !isNaN(Number(v)) ? Number(v) : null;

    return [
      undefined,
      new CreateAnswerDto(
        Number(questionnaireId),
        Number(questionId),
        toNumOrNull(selectedOptionId),
        toNumOrNull(navigationSequence),
        toNumOrNull(questionTimeSeconds),
        toNumOrNull(numberOfChanges),
        toNumOrNull(numberOfClicks),
        toNumOrNull(timesReviewed),
      ),
    ];
  }
}
