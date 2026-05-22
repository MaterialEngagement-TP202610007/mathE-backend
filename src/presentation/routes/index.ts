import { Router } from "express";
import { AuthRoutes } from "./auth.routes.js";
import { UserRoutes } from "./user.routes.js";
import { QuestionRoutes } from "./question.routes.js";

export class AppRoutes {
  static get routes(): Router {
    const router = Router();

    router.use("/api/auth", AuthRoutes.routes);
    router.use("/api/users", UserRoutes.routes);
    router.use("/api/questions", QuestionRoutes.routes);

    return router;
  }
}
