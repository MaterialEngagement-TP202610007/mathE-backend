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
     * components:
     *   schemas:
     *     School:
     *       type: object
     *       properties:
     *         id: { type: integer, example: 1593 }
     *         institutionKey: { type: string, example: LOC-337988-CLARETIANO }
     *         cenEdu: { type: string, example: CLARETIANO }
     *         district: { type: string, example: SAN MIGUEL }
     *         address: { type: string }
     *         businessName: { type: string }
     *         levels: { type: array, items: { type: string }, example: [Primaria, Secundaria] }
     *         codMods: { type: array, items: { type: string }, example: ["0331041", "0336743"] }
     *         createdAt: { type: string, format: date-time }
     *         updatedAt: { type: string, format: date-time }
     */

    /**
     * @openapi
     * /api/schools:
     *   get:
     *     tags: [Schools]
     *     summary: List schools (paginated). Public. Supports name and district search.
     *     description: >
     *       One item per real school — MINEDU per-level services (COD_MOD) sharing the
     *       same premises (CODLOCAL) and name are merged, so `levels` and `codMods` list
     *       all of them. Homonymous schools in different premises stay separate.
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 10, maximum: 50 }
     *         description: Page size, capped at 50.
     *       - in: query
     *         name: search
     *         schema: { type: string }
     *         description: Case-insensitive partial match on the school name (cenEdu). Use for the frontend searchbox.
     *       - in: query
     *         name: district
     *         schema: { type: string }
     *         description: Case-insensitive partial match on the district.
     *     responses:
     *       200:
     *         description: Paginated schools ordered by name, then district
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 items:
     *                   type: array
     *                   items: { $ref: '#/components/schemas/School' }
     *                 total: { type: integer }
     *                 page: { type: integer }
     *                 limit: { type: integer }
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
     *       200:
     *         description: School detail
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/School' }
     *       400: { description: Invalid id }
     *       404: { description: School not found }
     */
    router.get("/:id", controller.getById);

    return router;
  }
}
