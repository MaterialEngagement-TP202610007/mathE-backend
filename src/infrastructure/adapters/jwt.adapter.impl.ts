import jwt from "jsonwebtoken";
import { envs } from "../../config/envs.js";
import {
  TokenAdapter,
  TokenPayload,
} from "../../domain/adapters/token.adapter.js";

export class JwtAdapter implements TokenAdapter {
  generate(
    payload: TokenPayload,
    duration: string = "2h",
  ): Promise<string | null> {
    return new Promise((resolve) => {
      jwt.sign(
        payload,
        envs.JWT_SEED,
        { expiresIn: duration as jwt.SignOptions["expiresIn"] },
        (err, token) => {
          resolve(err || !token ? null : token);
        },
      );
    });
  }

  verify(token: string): Promise<TokenPayload | null> {
    return new Promise((resolve) => {
      jwt.verify(token, envs.JWT_SEED, (err, decoded) => {
        resolve(err ? null : (decoded as TokenPayload));
      });
    });
  }
}
