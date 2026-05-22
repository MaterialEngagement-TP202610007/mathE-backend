import "dotenv/config";
import envVar from "env-var";

export const envs = {
  PORT: envVar.get("PORT").default(3000).asPortNumber(),
  DATABASE_URL: envVar.get("DATABASE_URL").required().asString(),
  JWT_SEED: envVar.get("JWT_SEED").required().asString(),

  // Gemini AI
  GEMINI_API_KEY: envVar.get("GEMINI_API_KEY").required().asString(),
  GEMINI_CHAT_MODEL: envVar
    .get("GEMINI_CHAT_MODEL")
    .default("gemini-2.0-flash")
    .asString(),
  GEMINI_EMBEDDING_MODEL: envVar
    .get("GEMINI_EMBEDDING_MODEL")
    .default("gemini-embedding-001")
    .asString(),
  GEMINI_EMBEDDING_DIMENSIONS: envVar
    .get("GEMINI_EMBEDDING_DIMENSIONS")
    .default("768")
    .asIntPositive(),

  // Question generation tuning
  QUESTION_SIMILARITY_THRESHOLD: envVar
    .get("QUESTION_SIMILARITY_THRESHOLD")
    .default("0.85")
    .asFloat(),
  QUESTION_MAX_GENERATION_ATTEMPTS: envVar
    .get("QUESTION_MAX_GENERATION_ATTEMPTS")
    .default("3")
    .asIntPositive(),
};
