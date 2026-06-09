import { Router } from "express";
import { SchoolController } from "../controllers/school.controller.js";
import { SchoolRepositoryImpl } from "../../infrastructure/repositories/school.repository.impl.js";
import { ListSchoolsUseCase } from "../../domain/use-cases/school/list-schools.use-case.js";
import { GetSchoolUseCase } from "../../domain/use-cases/school/get-school.use-case.js";

export class SchoolRoutes {
  static get routes(): Router {
    const router = Router();

    const schoolRepository = new SchoolRepositoryImpl();

    const controller = new SchoolController(
      new ListSchoolsUseCase(schoolRepository),
      new GetSchoolUseCase(schoolRepository),
    );

    // Public: the registration form (pre-login) needs to search/select a school.
    // School directory is non-sensitive public MINEDU data.

    /**
     * @openapi
     * /api/schools:
     *   get:
     *     tags: [Schools]
     *     summary: List schools (paginated). Public. Supports name search.
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 10 }
     *       - in: query
     *         name: search
     *         schema: { type: string }
     *         description: Case-insensitive partial match on the school name (cenEdu). Use for the frontend searchbox.
     *     responses:
     *       200: { description: Paginated schools ordered by name }
     *       400: { description: Invalid pagination params }
     */
    router.get("/", controller.listAll);

    /**
     * @openapi
     * /api/schools/{id}:
     *   get:
     *     tags: [Schools]
     *     summary: Get a single school by id. Public.
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200: { description: School detail }
     *       400: { description: Invalid id }
     *       404: { description: School not found }
     */
    router.get("/:id", controller.getById);

    return router;
  }
}
