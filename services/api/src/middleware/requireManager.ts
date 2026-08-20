import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/db.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      organizationId?: string;
    }
  }
}

/** À monter après `requireAuth`. Le JWT ne porte que l'userId (voir config/auth.ts) — on recharge
 * le rôle et l'organisation à chaque requête plutôt que de les faire confiance depuis le client. */
export async function requireManager(req: Request, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user || (user.role !== "manager" && user.role !== "admin") || !user.organizationId) {
    res.status(403).json({ error: "Réservé aux managers d'une équipe" });
    return;
  }
  req.organizationId = user.organizationId;
  next();
}
