import { NextFunction, Request, Response } from "express";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { CreateAnswerDto } from "../../domain/dtos/answer/create-answer.dto.js";
import { CreateAnswerUseCase } from "../../domain/use-cases/answer/create-answer.use-case.js";
import { ListAnswersUseCase } from "../../domain/use-cases/answer/list-answers.use-case.js";
import { GetAnswerUseCase } from "../../domain/use-cases/answer/get-answer.use-case.js";

export class AnswerController {
  constructor(
    private readonly createAnswerUseCase: CreateAnswerUseCase,
    private readonly listAnswersUseCase: ListAnswersUseCase,
    private readonly getAnswerUseCase: GetAnswerUseCase,
  ) {}

  private parsePagination(req: Request): [string?, PaginationDto?] {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    return PaginationDto.create(page, limit);
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    const questionnaireId = Number(req.params.id);
    if (isNaN(questionnaireId))
      return res.status(400).json({ error: "Invalid questionnaire id" });

    const [error, dto] = CreateAnswerDto.create({
      ...req.body,
      questionnaireId,
    });
    if (error) return res.status(400).json({ error });

    try {
      const answer = await this.createAnswerUseCase.execute(dto!);
      res.status(201).json(answer);
    } catch (err) {
      next(err);
    }
  };

  listByQuestionnaire = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const questionnaireId = Number(req.params.id);
    if (isNaN(questionnaireId))
      return res.status(400).json({ error: "Invalid questionnaire id" });

    const [pageError, pagination] = this.parsePagination(req);
    if (pageError) return res.status(400).json({ error: pageError });

    try {
      const result = await this.listAnswersUseCase.execute(
        questionnaireId,
        pagination!,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    const questionnaireId = Number(req.params.id);
    const answerId = Number(req.params.answerId);

    if (isNaN(questionnaireId))
      return res.status(400).json({ error: "Invalid questionnaire id" });
    if (isNaN(answerId))
      return res.status(400).json({ error: "Invalid answer id" });

    try {
      const answer = await this.getAnswerUseCase.execute(
        answerId,
        questionnaireId,
      );
      res.json(answer);
    } catch (err) {
      next(err);
    }
  };
}
