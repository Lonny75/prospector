import { Router } from "express";
import { prisma } from "../config/db.js";
import { signAuthToken } from "../config/auth.js";

/**
 * Connexion Google — flow "Authorization Code" côté serveur (pas de SDK Google côté mobile).
 *
 * 1. GET /start redirige vers Google avec notre client_id + ce même /callback comme redirect_uri.
 * 2. Google redirige vers GET /callback avec un code ; on l'échange contre un id_token, on
 *    retrouve/crée l'utilisateur par email, on émet notre propre JWT, et on redirige vers
 *    l'app mobile via son schéma personnalisé (prospector://auth-callback?token=...), capté comme
 *    une route normale par expo-router (voir apps/mobile/app/auth-callback.tsx).
 *
 * Ce détour par le backend évite d'avoir à enregistrer un client OAuth natif Android/iOS distinct
 * (empreinte SHA-1, bundle id) — un seul client "Web application" suffit, avec ce endpoint comme
 * unique redirect URI autorisée.
 */
export const googleAuthRouter = Router();

const GOOGLE_REDIRECT_URI = `${process.env.API_PUBLIC_URL ?? "https://prospector-production-882f.up.railway.app"}/auth/google/callback`;
const MOBILE_CALLBACK_SCHEME = "prospector://auth-callback";

googleAuthRouter.get("/start", (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("GOOGLE_CLIENT_ID manquant côté serveur");
    return;
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

googleAuthRouter.get("/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).send("Code d'autorisation manquant");
    return;
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET manquants");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error(`Échange de code Google échoué : ${await tokenRes.text()}`);
    const { access_token: accessToken } = (await tokenRes.json()) as { access_token: string };

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) throw new Error(`Récupération du profil Google échouée : ${await profileRes.text()}`);
    const profile = (await profileRes.json()) as { sub: string; email: string; name?: string };

    // On relie par email : un utilisateur déjà inscrit par mot de passe peut ensuite se connecter
    // via Google sans créer de doublon (schema.prisma garde googleId/passwordHash tous deux
    // nullable exactement pour ce cas).
    const email = profile.email.toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      update: { googleId: profile.sub },
      create: { email, name: profile.name ?? email, googleId: profile.sub },
    });

    res.redirect(`${MOBILE_CALLBACK_SCHEME}?token=${encodeURIComponent(signAuthToken(user.id))}`);
  } catch (err) {
    console.error("Échec de la connexion Google", err);
    res.redirect(`${MOBILE_CALLBACK_SCHEME}?error=google_auth_failed`);
  }
});
