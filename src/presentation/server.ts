import express, { Router } from "express";
import { Server as HttpServer } from "node:http";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { requestLogger } from "./middlewares/request-logger.middleware.js";
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
  private httpServer?: HttpServer;

  constructor(options: ServerOptions) {
    this.port = options.port;
    this.routes = options.routes;
  }

  async start(): Promise<void> {
    // Render (and the Netlify proxy in front of it) terminate TLS upstream.
    this.app.set("trust proxy", 1);

    this.app.use(requestLogger);

    this.app.use(
      cors({
        origin: envs.CORS_ORIGIN,
        credentials: true,
      }),
    );

    this.app.use(express.json());
    this.app.use(cookieParser());

    // API responses are per-user — never let the proxy/CDN cache them.
    this.app.use("/api", (_req, res, next) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    });

    this.app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec),
    );

    this.app.use(this.routes);
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);

    await new Promise<void>((resolve, reject) => {
      const server = this.app.listen(this.port, (err?: Error) => {
        if (err) return reject(err);
        console.log(`Server running on port ${this.port}`);
        console.log(`Swagger docs on http://localhost:${this.port}/api-docs`);
        resolve();
      });
      this.httpServer = server;
    });
  }

  /** Stops accepting new connections and resolves once open ones have closed. */
  async stop(): Promise<void> {
    const server = this.httpServer;
    if (!server) return;

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
      server.closeIdleConnections();
    });
  }
}
