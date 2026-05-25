const ALLOWED_STATUSES = ["pending", "approved", "rejected"] as const;
type ValidationStatus = (typeof ALLOWED_STATUSES)[number];

export class ListQuestionsDto {
  private constructor(
    public teacherId: number,
    public validationStatus: ValidationStatus | null,
  ) {}

  static create(object: { [key: string]: any }): [string?, ListQuestionsDto?] {
    const { teacherId, status } = object;

    if (!teacherId || isNaN(Number(teacherId)))
      return ["Missing or invalid teacherId"];

    if (status !== undefined && !ALLOWED_STATUSES.includes(status))
      return [`Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}`];

    return [
      undefined,
      new ListQuestionsDto(
        Number(teacherId),
        (status as ValidationStatus) ?? null,
      ),
    ];
  }
}
