import { NextFunction, Request, Response } from "express";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { GenerateQuestionDto } from "../../domain/dtos/question/generate-question.dto.js";
import { ListQuestionsDto } from "../../domain/dtos/question/list-questions.dto.js";
import { RejectQuestionDto } from "../../domain/dtos/question/reject-question.dto.js";
import { ValidatedHistoryDto } from "../../domain/dtos/question/validated-history.dto.js";
import { BulkGenerateQuestionsUseCase } from "../../domain/use-cases/question/bulk-generate-questions.use-case.js";
import { ListQuestionsUseCase } from "../../domain/use-cases/question/list-questions.use-case.js";
import { ValidatedHistoryUseCase } from "../../domain/use-cases/question/validated-history.use-case.js";
import { GetQuestionUseCase } from "../../domain/use-cases/question/get-question.use-case.js";
import { ApproveQuestionUseCase } from "../../domain/use-cases/question/approve-question.use-case.js";
import { RejectQuestionUseCase } from "../../domain/use-cases/question/reject-question.use-case.js";
import { DeleteQuestionUseCase } from "../../domain/use-cases/question/delete-question.use-case.js";
import { SseNotificationService } from "../../infrastructure/services/sse-notification.service.js";

export class QuestionController {
  constructor(
    private readonly bulkGenerateQuestionsUseCase: BulkGenerateQuestionsUseCase,
    private readonly listQuestionsUseCase: ListQuestionsUseCase,
    private readonly validatedHistoryUseCase: ValidatedHistoryUseCase,
    private readonly getQuestionUseCase: GetQuestionUseCase,
    private readonly approveQuestionUseCase: ApproveQuestionUseCase,
    private readonly rejectQuestionUseCase: RejectQuestionUseCase,
    private readonly deleteQuestionUseCase: DeleteQuestionUseCase,
    private readonly sseService: SseNotificationService,
  ) {}

  private parsePagination(req: Request): [string?, PaginationDto?] {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    return PaginationDto.create(page, limit);
  }

  generate = async (req: Request, res: Response, next: NextFunction) => {
    const rawCount = req.query.count !== undefined ? Number(req.query.count) : 1;
    if (!Number.isInteger(rawCount) || rawCount < 1 || rawCount > 10) {
      return res.status(400).json({ error: "count must be an integer between 1 and 10" });
    }

    const [error, dto] = GenerateQuestionDto.create({
      ...req.body,
      teacherId: req.body.teacherId ?? req.user?.id,
    });
    if (error) return res.status(400).json({ error });

    const userId = req.user!.id;

    res.status(202).json({
      message: "Generation started",
      vakStyle: dto!.vakStyle,
      count: rawCount,
    });

    this.bulkGenerateQuestionsUseCase
      .execute(dto!, rawCount, userId, {
        onGenerated: (q) => {
          this.sseService.push(userId, "notification", {
            type: "question_generated",
            questionId: q.id,
            vakStyle: q.vakStyle,
          });
        },
        onFailed: () => {
          this.sseService.push(userId, "notification", {
            type: "question_failed",
            vakStyle: dto!.vakStyle,
          });
        },
      })
      .catch(() => {});
  };

  listMyQuestions = async (req: Request, res: Response, next: NextFunction) => {
    const [filterError, dto] = ListQuestionsDto.create({
      ...req.query,
      teacherId: req.user?.id,
    });
    if (filterError) return res.status(400).json({ error: filterError });

    const [pageError, pagination] = this.parsePagination(req);
    if (pageError) return res.status(400).json({ error: pageError });

    try {
      const result = await this.listQuestionsUseCase.execute(dto!, pagination!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  validatedHistory = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const [filterError, filterDto] = ValidatedHistoryDto.create(req.query);
    if (filterError) return res.status(400).json({ error: filterError });

    const [pageError, pagination] = this.parsePagination(req);
    if (pageError) return res.status(400).json({ error: pageError });

    try {
      const result = await this.validatedHistoryUseCase.execute(
        req.user!.id,
        pagination!,
        filterDto,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid question id" });

    try {
      const question = await this.getQuestionUseCase.execute(id);
      res.json(question);
    } catch (err) {
      next(err);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid question id" });

    try {
      const question = await this.approveQuestionUseCase.execute(id);
      res.json(question);
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid question id" });

    const [error, dto] = RejectQuestionDto.create(req.body);
    if (error) return res.status(400).json({ error });

    try {
      const question = await this.rejectQuestionUseCase.execute(id, dto!);
      res.json(question);
    } catch (err) {
      next(err);
    }
  };

  softDelete = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid question id" });

    try {
      await this.deleteQuestionUseCase.execute(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
