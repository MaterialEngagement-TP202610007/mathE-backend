export class CompleteQuestionnaireDto {
  private constructor(
    public totalTimeSeconds: number | null,
    public completionPercentage: number | null,
  ) {}

  static create(object: { [key: string]: any }): [string?, CompleteQuestionnaireDto?] {
    const { totalTimeSeconds, completionPercentage } = object;

    const toPositiveNumOrNull = (v: any, field: string): [string?, number?] => {
      if (v === undefined || v === null) return [undefined, undefined];
      const n = Number(v);
      if (isNaN(n) || n < 0) return [`${field} must be a non-negative number`];
      return [undefined, n];
    };

    const [tsErr, ts] = toPositiveNumOrNull(totalTimeSeconds, "totalTimeSeconds");
    if (tsErr) return [tsErr];

    const [cpErr, cp] = toPositiveNumOrNull(completionPercentage, "completionPercentage");
    if (cpErr) return [cpErr];

    if (cp !== undefined && (cp < 0 || cp > 100))
      return ["completionPercentage must be between 0 and 100"];

    return [
      undefined,
      new CompleteQuestionnaireDto(ts ?? null, cp ?? null),
    ];
  }
}
