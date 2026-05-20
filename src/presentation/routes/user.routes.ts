import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleGuard, selfOrRoleGuard } from "../middlewares/role.middleware.js";
import { ROLES } from "../../domain/constants/roles.constant.js";
import { UserRepositoryImpl } from "../../infrastructure/repositories/user.repository.impl.js";
import { GetUsersUseCase } from "../../domain/use-cases/user/get-users.use-case.js";
import { GetStudentsUseCase } from "../../domain/use-cases/user/get-students.use-case.js";
import { GetTeachersUseCase } from "../../domain/use-cases/user/get-teachers.use-case.js";
import { GetStudentsBySchoolUseCase } from "../../domain/use-cases/user/get-students-by-school.use-case.js";
import { GetUserByIdUseCase } from "../../domain/use-cases/user/get-user-by-id.use-case.js";
import { UpdateUserProfileUseCase } from "../../domain/use-cases/user/update-user-profile.use-case.js";
import { DeleteUserUseCase } from "../../domain/use-cases/user/delete-user.use-case.js";
import { ActivateUserUseCase } from "../../domain/use-cases/user/activate-user.use-case.js";

export class UserRoutes {
  static get routes(): Router {
    const router = Router();

    const userRepository = new UserRepositoryImpl();

    const controller = new UserController(
      new GetUsersUseCase(userRepository),
      new GetStudentsUseCase(userRepository),
      new GetTeachersUseCase(userRepository),
      new GetStudentsBySchoolUseCase(userRepository),
      new GetUserByIdUseCase(userRepository),
      new UpdateUserProfileUseCase(userRepository),
      new DeleteUserUseCase(userRepository),
      new ActivateUserUseCase(userRepository),
    );

    // Every endpoint requires authentication; role checks come after.
    router.use(authMiddleware);

    /**
     * @openapi
     * /api/users:
     *   get:
     *     tags: [Users]
     *     summary: List all users (paginated). Admin only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 10 }
     *     responses:
     *       200: { description: Paginated user list }
     *       401: { description: Not authenticated }
     *       403: { description: Insufficient permissions }
     */
    router.get("/", roleGuard(ROLES.ADMIN), controller.getAll);

    /**
     * @openapi
     * /api/users/students:
     *   get:
     *     tags: [Users]
     *     summary: List all students. Admin or Teacher.
     *     security: [{ bearerAuth: [] }]
     *     responses:
     *       200: { description: Paginated student list }
     */
    router.get(
      "/students",
      roleGuard(ROLES.ADMIN, ROLES.TEACHER),
      controller.getStudents,
    );

    /**
     * @openapi
     * /api/users/teachers:
     *   get:
     *     tags: [Users]
     *     summary: List all teachers. Admin only.
     *     security: [{ bearerAuth: [] }]
     *     responses:
     *       200: { description: Paginated teacher list }
     */
    router.get("/teachers", roleGuard(ROLES.ADMIN), controller.getTeachers);

    /**
     * @openapi
     * /api/users/students/by-school/{schoolId}:
     *   get:
     *     tags: [Users]
     *     summary: List students that belong to a school. Admin or Teacher.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: schoolId
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200: { description: Paginated student list }
     */
    router.get(
      "/students/by-school/:schoolId",
      roleGuard(ROLES.ADMIN, ROLES.TEACHER),
      controller.getStudentsBySchool,
    );

    /**
     * @openapi
     * /api/users/{id}:
     *   get:
     *     tags: [Users]
     *     summary: Get a user by id. Admin or the user themselves.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200: { description: User payload }
     *       404: { description: User not found }
     */
    router.get("/:id", selfOrRoleGuard(ROLES.ADMIN), controller.getById);

    /**
     * @openapi
     * /api/users/{id}:
     *   put:
     *     tags: [Users]
     *     summary: Update a user's profile. Admin or the user themselves.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name: { type: string }
     *               birthDate: { type: string, format: date }
     *               phoneNumber: { type: string, nullable: true }
     *               academicGradeId: { type: integer, nullable: true }
     *               schoolId: { type: integer, nullable: true }
     *     responses:
     *       200: { description: Updated user }
     *       400: { description: Validation error }
     *       404: { description: User not found }
     */
    router.put("/:id", selfOrRoleGuard(ROLES.ADMIN), controller.updateProfile);

    /**
     * @openapi
     * /api/users/{id}:
     *   delete:
     *     tags: [Users]
     *     summary: Soft-delete a user. Admin only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200: { description: User deleted }
     */
    router.delete("/:id", roleGuard(ROLES.ADMIN), controller.delete);

    /**
     * @openapi
     * /api/users/{id}/activate:
     *   patch:
     *     tags: [Users]
     *     summary: Activate a user (sets is_active=true). Admin only.
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200: { description: User activated }
     *       400: { description: Already active or deleted }
     */
    router.patch(
      "/:id/activate",
      roleGuard(ROLES.ADMIN),
      controller.activate,
    );

    return router;
  }
}
