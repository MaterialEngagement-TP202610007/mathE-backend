import { ResultRepository } from "../../repositories/result.repository.js";
import { ResultEntity } from "../../entities/result.entity.js";
import { CorrectResultLabelDto } from "../../dtos/result/correct-result-label.dto.js";
import { CustomError } from "../../error/custom-error.js";

export class CorrectResultLabelUseCase {
  constructor(
    private readonly resultRepository: ResultRepository,
    /** Clock for the HU-44 correction audit; injectable for tests. */
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    resultId: number,
    teacherId: number,
    dto: CorrectResultLabelDto,
  ): Promise<ResultEntity> {
    const existing = await this.resultRepository.findById(resultId);
    if (!existing) throw CustomError.notFound("Result not found");

    return this.resultRepository.correctLabel({
      resultId,
      teacherId,
      vakLabel: dto.vakLabel,
      correctedAt: this.now(),
    });
  }
}
