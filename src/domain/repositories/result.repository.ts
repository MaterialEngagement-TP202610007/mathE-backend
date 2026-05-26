import { ResultEntity } from "../entities/result.entity.js";
import { SaveResultData } from "../interfaces/result/index.js";

export abstract class ResultRepository {
  abstract saveWithDatasetAndNotification(
    data: SaveResultData,
  ): Promise<ResultEntity>;
}
