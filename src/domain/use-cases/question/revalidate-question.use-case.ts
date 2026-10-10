import { QuestionEntity } from "../../entities/question.entity.js";
import { QuestionRepository } from "../../repositories/question.repository.js";
import { SchoolAccessPolicy } from "../../policies/school-access.policy.js";
import { ItemValidatorAdapter } from "../../adapters/item-validator.adapter.js";
import { Requester } from "../../interfaces/shared/requester.interface.js";
import type { VakValue } from "../../constants/vak.constant.js";
import { CustomError } from "../../error/custom-error.js";
import type {
  MviAttemptRecord,
  MviValidationRecord,
} from "../../interfaces/item-validation/index.js";

export interface RevalidateQuestionConfig {
  now?: () => Date;
}

/**
 * Manual MVI re-run for a stored question, e.g. when the validator was
 * unavailable at generation time or the rule catalog changed. Validator
 * errors propagate so the caller sees why it failed. The result is appended
 * to the stored history instead of overwriting the generation trace.
 */
export class RevalidateQuestionUseCase {
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly schoolAccessPolicy: SchoolAccessPolicy,
    private readonly itemValidator: ItemValidatorAdapter | null,
    private readonly config: RevalidateQuestionConfig = {},
  ) {}

  async execute(id: number, requester: Requester): Promise<QuestionEntity> {
    if (!this.itemValidator)
      throw CustomError.badRequest("MVI integration is disabled");

    const question = await this.questionRepository.findById(id);
    if (!question) throw CustomError.notFound(`Question ${id} not found`);
    await this.schoolAccessPolicy.assertCanManageQuestion(requester, question);

    const bank = question.schoolId
      ? await this.questionRepository.findBankStatements(
          question.schoolId,
          question.id,
        )
      : [];

    const options = question.options.map((o) => ({
      text: o.text,
      vakValue: o.vakValue as VakValue,
    }));
    const { results, catalogVersion } = await this.itemValidator.validate(
      [
        {
          id: String(question.id),
          statement: question.statement,
          vakStyle: question.vakStyle,
          options,
        },
      ],
      bank,
    );

    const result = results[0];
    if (!result) throw CustomError.badGateway("MVI returned no result");

    // Cached by the adapter and never throws; null keeps the stored rules.
    const catalog = await this.itemValidator.getCatalog();
    const previous = question.mviResult;
    const previousHistory = Array.isArray(previous?.history) ? previous.history : [];
    const validatedAt = (this.config.now ?? (() => new Date()))();

    const entry: MviAttemptRecord = {
      attempt: previousHistory.length + 1,
      kind: "revalidation",
      statement: question.statement,
      options,
      approved: result.approved,
      violations: result.violations,
      validatedAt: validatedAt.toISOString(),
    };
    const rules = catalog?.rules ?? previous?.rules;

    const mviResult: MviValidationRecord = {
      approved: result.approved,
      violations: result.violations,
      // Keeps the generation-loop count; a revalidation is not a generation attempt.
      attempts: typeof previous?.attempts === "number" ? previous.attempts : 1,
      history: [...previousHistory, entry],
      ...(rules && { rules }),
    };

    return this.questionRepository.updateMviValidation(id, {
      mviStatus: result.approved ? "passed" : "failed",
      mviResult,
      mviCatalogVersion: catalogVersion,
      mviValidatedAt: validatedAt,
    });
  }
}
