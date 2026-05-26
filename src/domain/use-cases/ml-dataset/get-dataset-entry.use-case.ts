import { MLDatasetRepository } from "../../repositories/ml-dataset.repository.js";
import { MLDatasetEntity } from "../../entities/ml-dataset.entity.js";
import { CustomError } from "../../error/custom-error.js";

export class GetDatasetEntryUseCase {
  constructor(private readonly mlDatasetRepository: MLDatasetRepository) {}

  async execute(id: number): Promise<MLDatasetEntity> {
    const entry = await this.mlDatasetRepository.findById(id);
    if (!entry) throw CustomError.notFound("Dataset entry not found");
    return entry;
  }
}
