export class CreateQuestionnaireDto {
  private constructor(public studentId: number) {}

  static create(object: { [key: string]: any }): [string?, CreateQuestionnaireDto?] {
    const { studentId } = object;

    if (!studentId || isNaN(Number(studentId)))
      return ["Missing or invalid studentId"];

    return [undefined, new CreateQuestionnaireDto(Number(studentId))];
  }
}
