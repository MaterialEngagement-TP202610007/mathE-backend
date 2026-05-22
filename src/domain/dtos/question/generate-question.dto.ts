import { VAK_STYLES, VakStyle } from "../../constants/vak.constant.js";

/**
 * Input for question generation. The caller picks the target VAK style; the
 * statement and options are produced by the AI generator, not the client.
 * `teacherId` is optional — set when a teacher requests generation so the
 * question is attributed to them as pedagogical validator.
 */
export class GenerateQuestionDto {
  private constructor(
    public vakStyle: VakStyle,
    public teacherId: number | null,
  ) {}

  static create(object: { [key: string]: any }): [string?, GenerateQuestionDto?] {
    const { vakStyle, teacherId } = object;

    if (!vakStyle) return ["Missing Vak Style"];
    if (!VAK_STYLES.includes(vakStyle)) {
      return [`Invalid Vak Style. Allowed: ${VAK_STYLES.join(", ")}`];
    }

    if (teacherId !== undefined && teacherId !== null && isNaN(Number(teacherId))) {
      return ["Invalid Teacher Id"];
    }

    return [
      undefined,
      new GenerateQuestionDto(
        vakStyle,
        teacherId !== undefined && teacherId !== null ? Number(teacherId) : null,
      ),
    ];
  }
}
