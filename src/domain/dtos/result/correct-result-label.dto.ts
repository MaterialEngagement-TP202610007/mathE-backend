const VALID_STYLES = ["Visual", "Auditory", "Kinesthetic"] as const;

export class CorrectResultLabelDto {
  private constructor(public readonly vakLabel: string) {}

  static create(
    object: { [key: string]: any },
  ): [string?, CorrectResultLabelDto?] {
    const { vakLabel } = object;

    if (!vakLabel) return ["Missing vakLabel"];
    if (!VALID_STYLES.includes(vakLabel as any))
      return [
        `vakLabel must be one of: ${VALID_STYLES.join(", ")}`,
      ];

    return [undefined, new CorrectResultLabelDto(vakLabel)];
  }
}
