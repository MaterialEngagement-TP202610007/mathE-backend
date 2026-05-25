export class RejectQuestionDto {
  private constructor(public rejectionReason: string) {}

  static create(object: { [key: string]: any }): [string?, RejectQuestionDto?] {
    const { rejectionReason } = object;

    if (!rejectionReason || typeof rejectionReason !== "string" || rejectionReason.trim().length === 0)
      return ["Missing or empty rejectionReason"];

    return [undefined, new RejectQuestionDto(rejectionReason.trim())];
  }
}
