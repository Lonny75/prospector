import { Router } from "express";
import { prisma } from "../config/db.js";

/** Endpoints de lecture du catalogue (secteurs/personas/niveaux/formats) pour l'app mobile. */
export const catalogRouter = Router();

catalogRouter.get("/sectors", async (_req, res) => {
  res.json(await prisma.sector.findMany());
});

catalogRouter.get("/sectors/:sectorId/personas", async (req, res) => {
  res.json(await prisma.persona.findMany({ where: { sectorId: req.params.sectorId } }));
});

catalogRouter.get("/objection-levels", async (_req, res) => {
  res.json(await prisma.objectionLevel.findMany());
});

catalogRouter.get("/call-formats", async (_req, res) => {
  res.json(await prisma.callFormat.findMany());
});

/** Phase 0/1 uniquement — pas d'auth encore, à retirer une fois la Phase 3 (OAuth) en place. */
catalogRouter.get("/test-user", async (_req, res) => {
  res.json(await prisma.user.findFirstOrThrow());
});
