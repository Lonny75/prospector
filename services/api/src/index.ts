import "dotenv/config";
import express from "express";
import cors from "cors";
import { voiceLlmProxyRouter } from "./routes/voice-llm-proxy.js";
import { sessionsRouter } from "./routes/sessions.js";
import { catalogRouter } from "./routes/catalog.js";
import { authRouter } from "./routes/auth.js";
import { googleAuthRouter } from "./routes/googleAuth.js";
import { organizationsRouter } from "./routes/organizations.js";
import { billingRouter, handleStripeWebhook } from "./routes/billing.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { anthropic, CLAUDE_PROSPECT_MODEL } from "./config/anthropic.js";

const app = express();
app.use(cors());

// Monté AVANT express.json() : Stripe exige le corps brut (non parsé) pour vérifier la signature
// de la requête (voir routes/billing.ts).
app.post("/billing/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/voice/llm", voiceLlmProxyRouter);
app.use("/auth", authRouter);
app.use("/auth/google", googleAuthRouter);
app.use("/sessions", requireAuth, sessionsRouter);
app.use("/catalog", catalogRouter);
app.use("/organizations", requireAuth, organizationsRouter);
app.use("/billing", requireAuth, billingRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
  console.log(`Prospector API démarrée sur http://localhost:${port}`);
  console.log(`DEBUG FRONTEND_URL=${JSON.stringify(process.env.FRONTEND_URL)}`);

  // Le tout premier appel Anthropic après un (re)démarrage du conteneur coûte ~10s (connexion TLS
  // à froid), indépendamment du prompt — observé le 2026-08-19 en isolant deux appels identiques
  // sur la même combinaison (11s puis 2,8s). On paie ce coût ici, au démarrage, plutôt que sur le
  // premier appel réel d'un utilisateur.
  anthropic.messages
    .create({ model: CLAUDE_PROSPECT_MODEL, max_tokens: 1, messages: [{ role: "user", content: "." }] })
    .then(() => console.log("Connexion Anthropic préchauffée"))
    .catch((err) => console.error("Échec du préchauffage de la connexion Anthropic", err));
});
