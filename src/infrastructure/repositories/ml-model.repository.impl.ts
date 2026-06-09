import { prisma } from "../../config/database/index.js";
import { MLModelRepository } from "../../domain/repositories/ml-model.repository.js";
import { MLModelEntity } from "../../domain/entities/ml-model.entity.js";

export class MLModelRepositoryImpl implements MLModelRepository {
  async findActive(): Promise<MLModelEntity | null> {
    const model = await prisma.mLModel.findFirst({
      where: { isActive: true },
    });

    return model ? MLModelEntity.fromObject(model) : null;
  }
}
