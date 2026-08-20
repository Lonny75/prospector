import { randomBytes } from "node:crypto";
import { Router } from "express";
import { prisma } from "../config/db.js";
import { requireManager } from "../middleware/requireManager.js";

export const organizationsRouter = Router();

organizationsRouter.use(requireManager);

organizationsRouter.get("/me", async (req, res) => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: req.organizationId } });

  const members = await prisma.user.findMany({
    where: { organizationId: org.id },
    include: { trainingSessions: { include: { debrief: true } } },
  });

  res.json({
    id: org.id,
    name: org.name,
    plan: org.plan,
    seatsPurchased: org.seatsPurchased,
    subscriptionStatus: org.subscriptionStatus,
    trialEndsAt: org.trialEndsAt,
    inviteCode: org.inviteCode,
    members: members.map((m) => {
      const scores = m.trainingSessions.map((s) => s.debrief?.overallScore).filter((s): s is number => s != null);
      return {
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        sessionCount: m.trainingSessions.length,
        averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      };
    }),
  });
});

organizationsRouter.post("/me/regenerate-invite-code", async (req, res) => {
  const inviteCode = randomBytes(4).toString("hex");
  const org = await prisma.organization.update({ where: { id: req.organizationId }, data: { inviteCode } });
  res.json({ inviteCode: org.inviteCode });
});
