import { NextFunction, Request, Response } from "express";
import { GenerateQuestionDto } from "../../domain/dtos/question/generate-question.dto.js";
import { GenerateQuestionUseCase } from "../../domain/use-cases/question/generate-question.use-case.js";

export class QuestionController {
  constructor(
    private readonly generateQuestionUseCase: GenerateQuestionUseCase,
  ) {}

  generate = async (req: Request, res: Response, next: NextFunction) => {
    // Attribute the question to the requesting teacher when present.
    const [error, dto] = GenerateQuestionDto.create({
      ...req.body,
      teacherId: req.body.teacherId ?? req.user?.id,
    });
    if (error) return res.status(400).json({ error });

    try {
      const question = await this.generateQuestionUseCase.execute(dto!);
      res.status(201).json(question);
    } catch (err) {
      next(err);
    }
  };
}
