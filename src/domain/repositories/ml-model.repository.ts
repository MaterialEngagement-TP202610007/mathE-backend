import { MLModelEntity } from "../entities/ml-model.entity.js";

export abstract class MLModelRepository {
  abstract findActive(): Promise<MLModelEntity | null>;
}
