import express, { Router } from "express";
import { errorHandler } from "./middlewares/error.middleware.js";

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
    this.app.use(express.json());
    this.app.use(this.routes);
    this.app.use(errorHandler);

    this.app.listen(this.port, () => {
      console.log(`Server running on port ${this.port}`);
    });
  }
}
