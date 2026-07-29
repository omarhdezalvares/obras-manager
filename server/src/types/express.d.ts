import { AccessTokenClaims } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenClaims;
    }
  }
}

export {};
