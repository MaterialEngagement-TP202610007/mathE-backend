import { AnswerInput, parseAnswerInput } from "./complete-questionnaire.dto.js";

const MAX_ANSWERS = 10;

/** Body of the progressive save (HU-29): 1 to 10 answers to upsert. */
export class SaveQuestionnaireProgressDto {
  private constructor(public answers: AnswerInput[]) {}

  static create(
    object: { [key: string]: any },
  ): [string?, SaveQuestionnaireProgressDto?] {
    const { answers } = object ?? {};

    if (
      !Array.isArray(answers) ||
      answers.length === 0 ||
      answers.length > MAX_ANSWERS
    )
      return [`answers must be an array of 1 to ${MAX_ANSWERS} items`];

    const parsed: AnswerInput[] = [];
    for (let i = 0; i < answers.length; i++) {
      const [error, answer] = parseAnswerInput(answers[i], i);
      if (error) return [error];
      parsed.push(answer!);
    }

    return [undefined, new SaveQuestionnaireProgressDto(parsed)];
  }
}
