import "dotenv/config";
import envVar from "env-var";

export const envs = {
  PORT: envVar.get("PORT").default(3000).asPortNumber(),
  DATABASE_URL: envVar.get("DATABASE_URL").required().asString(),
  JWT_SEED: envVar.get("JWT_SEED").required().asString(),
};
