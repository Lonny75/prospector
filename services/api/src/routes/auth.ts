import { randomBytes } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/db.js";
import { signAuthToken } from "../config/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

function publicUser(user: { id: string; email: string; name: string; role: string; organizationId: string | null }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId };
}

authRouter.post("/signup", async (req, res) => {
  const { email, name, password, organizationName, inviteCode } = req.body as {
    email?: string;
    name?: string;
    password?: string;
    // Mutuellement exclusifs : crée une équipe (devient manager) ou en rejoint une (reste rep).
    // Aucun des deux -> comportement historique inchangé (rep sans organisation).
    organizationName?: string;
    inviteCode?: string;
  };
  if (!email || !name || !password) {
    res.status(400).json({ error: "email, name et password sont requis" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères" });
    return;
  }
  if (organizationName && inviteCode) {
    res.status(400).json({ error: "organizationName et inviteCode sont mutuellement exclusifs" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    res.status(409).json({ error: "Un compte existe déjà avec cet email" });
    return;
  }

  let organizationId: string | undefined;
  let role: "rep" | "manager" = "rep";

  if (organizationName) {
    const org = await prisma.organization.create({
      data: { name: organizationName, inviteCode: randomBytes(4).toString("hex") },
    });
    organizationId = org.id;
    role = "manager";
  } else if (inviteCode) {
    const org = await prisma.organization.findUnique({ where: { inviteCode } });
    if (!org) {
      res.status(404).json({ error: "Code d'invitation invalide" });
      return;
    }
    organizationId = org.id;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), name, passwordHash, organizationId, role },
  });

  res.status(201).json({ token: signAuthToken(user.id), user: publicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "email et password sont requis" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  res.json({ token: signAuthToken(user.id), user: publicUser(user) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(401).json({ error: "Compte introuvable" });
    return;
  }
  res.json(publicUser(user));
});
