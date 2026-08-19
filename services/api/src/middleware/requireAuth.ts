import type { Request, Response, NextFunction } from "express";
import { verifyAuthToken } from "../config/auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }
  try {
    req.userId = verifyAuthToken(token).userId;
    next();
  } catch {
    res.status(401).json({ error: "Session invalide, reconnecte-toi" });
  }
}
