import express, { Router } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./middlewares/error.middleware.js";
import { swaggerSpec } from "../config/swagger.js";
import { envs } from "../config/envs.js";

interface ServerOptions {
  port: number;
  routes: Router;
}

export class Server {
  private readonly app = express();
  private readonly port: number;
  private readonly routes: Router;

  constructor(options: ServerOptions) {
    this.port = options.port;
    this.routes = options.routes;
  }

  async start() {
    this.app.use(
      cors({
        origin: envs.CORS_ORIGIN.split(",").map((o) => o.trim()),
        credentials: true,
      }),
    );

    this.app.use(express.json());
    this.app.use(cookieParser());

    this.app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec),
    );

    this.app.use(this.routes);
    this.app.use(errorHandler);

    this.app.listen(this.port, () => {
      console.log(`Server running on port ${this.port}`);
      console.log(`Swagger docs on http://localhost:${this.port}/api-docs`);
    });
  }
}
