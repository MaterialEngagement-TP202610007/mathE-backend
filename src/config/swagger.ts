import swaggerJsdoc from "swagger-jsdoc";
import { envs } from "./envs.js";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Material Engagement API",
      version: "1.0.0",
      description:
        "REST API — educational platform with VAK learning style detection. Roles: Student and Teacher (RBAC).",
    },
    servers: [{ url: `http://localhost:${envs.PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  // Scan route files for JSDoc @openapi annotations.
  // Globs cover both dev (tsx, src/*.ts) and prod (compiled dist/*.js).
  apis: [
    "./src/presentation/routes/*.ts",
    "./dist/presentation/routes/*.js",
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
