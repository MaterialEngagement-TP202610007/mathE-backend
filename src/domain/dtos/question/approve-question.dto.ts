import { VAK_STYLES, VakStyle } from "../../constants/vak.constant.js";

/**
 * Optional body of the approve action (HU-42). The teacher states the VAK
 * style the question belongs to; when no style is sent the current one is
 * kept, so clients that approve without a body keep working.
 */
export class ApproveQuestionDto {
  private constructor(public vakStyle: VakStyle | null) {}

  static create(
    object: { [key: string]: any } | null | undefined,
  ): [string?, ApproveQuestionDto?] {
    const vakStyle = object?.vakStyle;

    if (vakStyle === undefined || vakStyle === null)
      return [undefined, new ApproveQuestionDto(null)];

    if (!VAK_STYLES.includes(vakStyle))
      return [`Invalid Vak Style. Allowed: ${VAK_STYLES.join(", ")}`];

    return [undefined, new ApproveQuestionDto(vakStyle)];
  }
}
