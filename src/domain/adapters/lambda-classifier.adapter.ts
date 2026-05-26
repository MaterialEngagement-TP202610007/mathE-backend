import {
  LambdaClassifierInput,
  LambdaClassifierOutput,
} from "../interfaces/result/index.js";

export abstract class LambdaClassifierAdapter {
  abstract classify(
    input: LambdaClassifierInput,
  ): Promise<LambdaClassifierOutput>;
}
