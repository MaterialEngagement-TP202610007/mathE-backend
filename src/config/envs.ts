import "dotenv/config";
import envVar from "env-var";

export const envs = {
  PORT: envVar.get("PORT").default(3000).asPortNumber(),
  DATABASE_URL: envVar.get("DATABASE_URL").required().asString(),
  JWT_SEED: envVar.get("JWT_SEED").required().asString(),

  // Comma-separated list of allowed origins.
  CORS_ORIGIN: envVar
    .get("CORS_ORIGIN")
    .default("http://localhost:5173")
    .asArray(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Auth session — used for both the JWT expiry and the cookie maxAge.
  SESSION_TTL_HOURS: envVar
    .get("SESSION_TTL_HOURS")
    .default("24")
    .asIntPositive(),

  // Gemini AI
  GEMINI_API_KEY: envVar.get("GEMINI_API_KEY").required().asString(),
  GEMINI_CHAT_MODEL: envVar
    .get("GEMINI_CHAT_MODEL")
    .default("gemini-3.6-flash")
    .asString(),
  GEMINI_EMBEDDING_MODEL: envVar
    .get("GEMINI_EMBEDDING_MODEL")
    .default("gemini-embedding-001")
    .asString(),
  GEMINI_EMBEDDING_DIMENSIONS: envVar
    .get("GEMINI_EMBEDDING_DIMENSIONS")
    .default("768")
    .asIntPositive(),

  QUESTION_MAX_GENERATION_ATTEMPTS: envVar
    .get("QUESTION_MAX_GENERATION_ATTEMPTS")
    .default("3")
    .asIntPositive(),
  QUESTION_GENERATION_CONCURRENCY: envVar
    .get("QUESTION_GENERATION_CONCURRENCY")
    .default("2")
    .asIntPositive(),

  GEMINI_IMAGE_MODEL: envVar
    .get("GEMINI_IMAGE_MODEL")
    .default("gemini-2.5-flash-image")
    .asString(),

  // Outbound request timeouts (ms). Lambda + feedback run synchronously
  // inside PATCH /complete and must stay well under the proxy limit.
  LAMBDA_TIMEOUT_MS: envVar.get("LAMBDA_TIMEOUT_MS").default("7000").asIntPositive(),
  GEMINI_FEEDBACK_TIMEOUT_MS: envVar
    .get("GEMINI_FEEDBACK_TIMEOUT_MS")
    .default("8000")
    .asIntPositive(),
  GEMINI_CHAT_TIMEOUT_MS: envVar
    .get("GEMINI_CHAT_TIMEOUT_MS")
    .default("30000")
    .asIntPositive(),
  GEMINI_EMBEDDING_TIMEOUT_MS: envVar
    .get("GEMINI_EMBEDDING_TIMEOUT_MS")
    .default("15000")
    .asIntPositive(),
  GEMINI_IMAGE_TIMEOUT_MS: envVar
    .get("GEMINI_IMAGE_TIMEOUT_MS")
    .default("60000")
    .asIntPositive(),

  // AWS S3 — image storage (optional: image generation is skipped when unset)
  AWS_BUCKET: envVar.get("AWS_BUCKET").default("").asString(),
  AWS_REGION: envVar.get("AWS_REGION").default("us-east-1").asString(),
  AWS_ACCESS_KEY_ID: envVar.get("AWS_ACCESS_KEY_ID").default("").asString(),
  AWS_SECRET_ACCESS_KEY: envVar.get("AWS_SECRET_ACCESS_KEY").default("").asString(),
  CLOUDFRONT_DOMAIN: envVar.get("CLOUDFRONT_DOMAIN").default("").asString(),

  // ML / Lambda
  LAMBDA_URL: envVar.get("LAMBDA_URL").default("").asString(),

  // MVI item validator (optional: empty MVI_URL disables it)
  MVI_URL: envVar.get("MVI_URL").default("").asString(),
  MVI_TOKEN: envVar.get("MVI_TOKEN").default("").asString(),
  MVI_TIMEOUT_MS: envVar.get("MVI_TIMEOUT_MS").default("15000").asIntPositive(),
  // Wake-up tolerates a cold start of the hosting platform.
  MVI_WAKEUP_TIMEOUT_MS: envVar
    .get("MVI_WAKEUP_TIMEOUT_MS")
    .default("60000")
    .asIntPositive(),
  MVI_MODE: envVar
    .get("MVI_MODE")
    .default("advisory")
    .asEnum(["off", "advisory", "gate"]),
  MVI_NIVEL: envVar.get("MVI_NIVEL").default("6").asIntPositive(),
};
