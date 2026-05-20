import { Router } from "express";
import { AuthRoutes } from "./auth.routes.js";
import { UserRoutes } from "./user.routes.js";

export class AppRoutes {
  static get routes(): Router {
    const router = Router();

    router.use("/api/auth", AuthRoutes.routes);
    router.use("/api/users", UserRoutes.routes);

    return router;
  }
}
