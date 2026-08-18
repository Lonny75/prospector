import { Router } from "express";
import { prisma } from "../config/db.js";
import { generateDebrief } from "../services/debriefEngine.js";

/**
 * Routes minimales pour la Phase 0/1 : créer une session d'entraînement et déclencher son débrief.
 * Pas d'authentification ici — à ajouter en Phase 3 (voir docs/plan.md). Suffisant pour les tests
 * de bout en bout du spike (voix + débrief) avec un utilisateur de test seedé (voir prisma/seed.ts).
 */
export const sessionsRouter = Router();

/** Historique des sessions d'un utilisateur, plus récentes en premier. */
sessionsRouter.get("/", async (req, res) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    res.status(400).json({ error: "userId requis" });
    return;
  }

  const sessions = await prisma.trainingSession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    include: { sector: true, persona: true, objectionLevel: true, callFormat: true, debrief: true },
  });

  res.json(
    sessions.map((s) => ({
      id: s.id,
      status: s.status,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      sectorLabel: s.sector.label,
      personaName: s.persona.name,
      objectionLevelLabel: s.objectionLevel.label,
      callFormatLabel: s.callFormat.label,
      overallScore: s.debrief?.overallScore ?? null,
    })),
  );
});

sessionsRouter.post("/", async (req, res) => {
  const { userId, sectorId, personaId, objectionLevelId, callFormatId } = req.body as {
    userId: string;
    sectorId: string;
    personaId: string;
    objectionLevelId: string;
    callFormatId: string;
  };

  const session = await prisma.trainingSession.create({
    data: { userId, sectorId, personaId, objectionLevelId, callFormatId },
  });

  res.status(201).json(session);
});

sessionsRouter.get("/:id", async (req, res) => {
  const session = await prisma.trainingSession.findUnique({
    where: { id: req.params.id },
    include: { persona: true, sector: true, objectionLevel: true, callFormat: true },
  });

  if (!session) {
    res.status(404).json({ error: "Session introuvable" });
    return;
  }

  res.json(session);
});

sessionsRouter.post("/:id/end", async (req, res) => {
  const session = await prisma.trainingSession.update({
    where: { id: req.params.id },
    data: { status: "completed", endedAt: new Date() },
  });

  res.json(session);
});

sessionsRouter.post("/:id/debrief", async (req, res) => {
  try {
    const result = await generateDebrief(req.params.id);
    res.json(result);
  } catch (err) {
    console.error("Erreur de génération du débrief", err);
    res.status(500).json({ error: "Échec de génération du débrief" });
  }
});

sessionsRouter.get("/:id/debrief", async (req, res) => {
  const debrief = await prisma.debrief.findUnique({
    where: { sessionId: req.params.id },
    include: { strengths: true, improvements: true, verbatims: true },
  });

  if (!debrief) {
    res.status(404).json({ error: "Pas encore de débrief pour cette session" });
    return;
  }

  // Le modèle Prisma stocke fond/forme à plat (fondScore, formeScore) + des tables séparées taguées
  // par catégorie — mais les clients (mobile, apps/voice-test) attendent la même forme imbriquée
  // que celle produite par Claude (DebriefResult dans @prospector/shared-types). On la reconstruit ici.
  function axis(category: "fond" | "forme", score: number) {
    return {
      score,
      strengths: debrief!.strengths
        .filter((s) => s.category === category)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((s) => s.text),
      improvements: debrief!.improvements
        .filter((i) => i.category === category)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((i) => ({ priority: i.priority as 1 | 2 | 3, text: i.text })),
      verbatims: debrief!.verbatims
        .filter((v) => v.axis === category)
        .map((v) => ({
          transcriptTurnIndex: v.transcriptTurnIndex,
          quoteText: v.quoteText,
          comment: v.comment,
          type: v.type,
          axis: v.axis,
        })),
    };
  }

  res.json({
    overallScore: debrief.overallScore,
    fond: axis("fond", debrief.fondScore),
    forme: axis("forme", debrief.formeScore),
  });
});
