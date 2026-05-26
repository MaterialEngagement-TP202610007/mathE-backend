import { Router } from "express";
import { AuthRoutes } from "./auth.routes.js";
import { UserRoutes } from "./user.routes.js";
import { QuestionRoutes } from "./question.routes.js";
import { QuestionnaireRoutes } from "./questionnaire.routes.js";
import { NotificationRoutes } from "./notification.routes.js";
import { ResultRoutes } from "./result.routes.js";
import { MLDatasetRoutes } from "./ml-dataset.routes.js";

export class AppRoutes {
  static get routes(): Router {
    const router = Router();

    router.use("/api/auth", AuthRoutes.routes);
    router.use("/api/users", UserRoutes.routes);
    router.use("/api/questions", QuestionRoutes.routes);
    router.use("/api/questionnaires", QuestionnaireRoutes.routes);
    router.use("/api/notifications", NotificationRoutes.routes);
    router.use("/api/results", ResultRoutes.routes);
    router.use("/api/ml-dataset", MLDatasetRoutes.routes);

    return router;
  }
}
