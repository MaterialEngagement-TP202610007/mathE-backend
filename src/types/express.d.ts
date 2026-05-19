// src/types/express.d.ts
import { TokenPayload } from "../domain/adapters/token.adapter.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export {};