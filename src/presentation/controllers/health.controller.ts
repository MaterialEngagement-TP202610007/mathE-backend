import { Request, Response } from "express";
import { CheckHealthUseCase } from "../../domain/use-cases/health/check-health.use-case.js";

export class HealthController {
  constructor(private readonly checkHealthUseCase: CheckHealthUseCase) {}

  check = async (_req: Request, res: Response) => {
    const health = await this.checkHealthUseCase.execute();
    res.status(health.status === "ok" ? 200 : 503).json(health);
  };
}
