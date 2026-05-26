import { LambdaClassifierAdapter } from "../../domain/adapters/lambda-classifier.adapter.js";
import {
  LambdaClassifierInput,
  LambdaClassifierOutput,
} from "../../domain/interfaces/result/index.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";

export class LambdaClassifierAdapterImpl implements LambdaClassifierAdapter {
  async classify(input: LambdaClassifierInput): Promise<LambdaClassifierOutput> {
    if (!envs.LAMBDA_URL) {
      throw CustomError.serviceUnavailable("Lambda URL not configured");
    }

    let response: Response;
    try {
      response = await fetch(envs.LAMBDA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: input.features }),
      });
    } catch {
      throw CustomError.serviceUnavailable("Lambda request failed");
    }

    if (!response.ok) {
      throw CustomError.badGateway(
        `Lambda returned status ${response.status}`,
      );
    }

    return response.json() as Promise<LambdaClassifierOutput>;
  }
}
