import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { envs } from "../envs.js";

const adapter = new PrismaPg({
  connectionString: envs.DATABASE_URL,
  max: 10,
  // Fail fast instead of hanging requests when the database is unreachable.
  connectionTimeoutMillis: 5000,
});

export const prisma = new PrismaClient({ adapter });
