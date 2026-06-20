const ALLOWED_VAK = ["Visual", "Auditory", "Kinesthetic"] as const;
type VakStyle = (typeof ALLOWED_VAK)[number];

export class ValidatedHistoryDto {
  private constructor(
    public vakStyle: VakStyle | null,
    public fromDate: Date | null,
    public toDate: Date | null,
  ) {}

  static create(object: { [key: string]: any }): [string?, ValidatedHistoryDto?] {
    const { vakStyle, fromDate, toDate } = object;

    if (vakStyle !== undefined && !ALLOWED_VAK.includes(vakStyle))
      return [`Invalid vakStyle. Allowed: ${ALLOWED_VAK.join(", ")}`];

    let parsedFrom: Date | null = null;
    let parsedTo: Date | null = null;

    if (fromDate) {
      parsedFrom = new Date(fromDate);
      if (isNaN(parsedFrom.getTime())) return ["Invalid fromDate"];
    }

    if (toDate) {
      parsedTo = new Date(toDate);
      if (isNaN(parsedTo.getTime())) return ["Invalid toDate"];
    }

    return [
      undefined,
      new ValidatedHistoryDto(
        (vakStyle as VakStyle) ?? null,
        parsedFrom,
        parsedTo,
      ),
    ];
  }
}
