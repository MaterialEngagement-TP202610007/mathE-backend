import { NextFunction, Request, Response } from "express";
import { PaginationDto } from "../../domain/dtos/shared/pagination.dto.js";
import { CorrectResultLabelDto } from "../../domain/dtos/result/correct-result-label.dto.js";
import { GetResultUseCase } from "../../domain/use-cases/result/get-result.use-case.js";
import { GetResultByQuestionnaireUseCase } from "../../domain/use-cases/result/get-result-by-questionnaire.use-case.js";
import { GetStudentResultsUseCase } from "../../domain/use-cases/result/get-student-results.use-case.js";
import { GetAllResultsUseCase } from "../../domain/use-cases/result/get-all-results.use-case.js";
import { CorrectResultLabelUseCase } from "../../domain/use-cases/result/correct-result-label.use-case.js";

export class ResultController {
  constructor(
    private readonly getResultUseCase: GetResultUseCase,
    private readonly getResultByQuestionnaireUseCase: GetResultByQuestionnaireUseCase,
    private readonly getStudentResultsUseCase: GetStudentResultsUseCase,
    private readonly getAllResultsUseCase: GetAllResultsUseCase,
    private readonly correctResultLabelUseCase: CorrectResultLabelUseCase,
  ) {}

  private parsePagination(req: Request): [string?, PaginationDto?] {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    return PaginationDto.create(page, limit);
  }

  getById = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid result id" });

    try {
      const result = await this.getResultUseCase.execute(
        id,
        req.user!.id,
        req.user!.roleId!,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getByQuestionnaire = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const questionnaireId = Number(req.params.questionnaireId);
    if (isNaN(questionnaireId))
      return res.status(400).json({ error: "Invalid questionnaire id" });

    try {
      const result = await this.getResultByQuestionnaireUseCase.execute(
        questionnaireId,
        req.user!.id,
        req.user!.roleId!,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction) => {
    const [error, pagination] = this.parsePagination(req);
    if (error) return res.status(400).json({ error });

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    if (startDate && isNaN(startDate.getTime()))
      return res.status(400).json({ error: "Invalid startDate" });
    if (endDate && isNaN(endDate.getTime()))
      return res.status(400).json({ error: "Invalid endDate" });

    const predominantStyle = req.query.predominantStyle as string | undefined;

    try {
      const result = await this.getStudentResultsUseCase.execute(
        req.user!.id,
        pagination!,
        { startDate, endDate, predominantStyle },
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  listAll = async (req: Request, res: Response, next: NextFunction) => {
    const [error, pagination] = this.parsePagination(req);
    if (error) return res.status(400).json({ error });

    const studentId = req.query.studentId
      ? Number(req.query.studentId)
      : undefined;
    const gradeId = req.query.gradeId ? Number(req.query.gradeId) : undefined;
    const schoolId = req.query.schoolId
      ? Number(req.query.schoolId)
      : undefined;
    const classifierType = req.query.classifierType as string | undefined;

    try {
      const result = await this.getAllResultsUseCase.execute(pagination!, {
        studentId: !isNaN(studentId!) ? studentId : undefined,
        gradeId: !isNaN(gradeId!) ? gradeId : undefined,
        schoolId: !isNaN(schoolId!) ? schoolId : undefined,
        classifierType,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  correctLabel = async (req: Request, res: Response, next: NextFunction) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid result id" });

    const [error, dto] = CorrectResultLabelDto.create(req.body);
    if (error) return res.status(400).json({ error });

    try {
      const result = await this.correctResultLabelUseCase.execute(
        id,
        req.user!.id,
        dto!,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
