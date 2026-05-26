import { NextFunction, Request, Response } from "express";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { CompleteQuestionnaireDto } from "../../domain/dtos/questionnaire/complete-questionnaire.dto.js";
import { CreateQuestionnaireUseCase } from "../../domain/use-cases/questionnaire/create-questionnaire.use-case.js";
import { GetQuestionnaireUseCase } from "../../domain/use-cases/questionnaire/get-questionnaire.use-case.js";
import { ListQuestionnairesUseCase } from "../../domain/use-cases/questionnaire/list-questionnaires.use-case.js";
import { CompleteQuestionnaireUseCase } from "../../domain/use-cases/questionnaire/complete-questionnaire.use-case.js";
import { AbandonQuestionnaireUseCase } from "../../domain/use-cases/questionnaire/abandon-questionnaire.use-case.js";

export class QuestionnaireController {
  constructor(
    private readonly createQuestionnaireUseCase: CreateQuestionnaireUseCase,
    private readonly getQuestionnaireUseCase: GetQuestionnaireUseCase,
    private readonly listQuestionnairesUseCase: ListQuestionnairesUseCase,
    private readonly completeQuestionnaireUseCase: CompleteQuestionnaireUseCase,
    private readonly abandonQuestionnaireUseCase: AbandonQuestionnaireUseCase,
  ) {}

  private parsePagination(req: Request): [string?, PaginationDto?] {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    return PaginationDto.create(page, limit);
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const questionnaire = await this.createQuestionnaireUseCase.execute(
        req.user!.id,
      );
      res.status(201).json(questionnaire);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ error: "Invalid questionnaire id" });

    try {
      const questionnaire = await this.getQuestionnaireUseCase.execute(id);
      res.json(questionnaire);
    } catch (err) {
      next(err);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction) => {
    const [pageError, pagination] = this.parsePagination(req);
    if (pageError) return res.status(400).json({ error: pageError });

    try {
      const result = await this.listQuestionnairesUseCase.execute(
        req.user!.id,
        pagination!,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  complete = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ error: "Invalid questionnaire id" });

    const [error, dto] = CompleteQuestionnaireDto.create(req.body);
    if (error) return res.status(400).json({ error });

    try {
      const result = await this.completeQuestionnaireUseCase.execute(
        id,
        req.user!.id,
        dto!,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  abandon = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ error: "Invalid questionnaire id" });

    try {
      const questionnaire =
        await this.abandonQuestionnaireUseCase.execute(id);
      res.json(questionnaire);
    } catch (err) {
      next(err);
    }
  };
}
