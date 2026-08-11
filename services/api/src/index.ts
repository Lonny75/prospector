import "dotenv/config";
import express from "express";
import cors from "cors";
import { voiceLlmProxyRouter } from "./routes/voice-llm-proxy.js";
import { sessionsRouter } from "./routes/sessions.js";
import { catalogRouter } from "./routes/catalog.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/voice/llm", voiceLlmProxyRouter);
app.use("/sessions", sessionsRouter);
app.use("/catalog", catalogRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
  console.log(`Prospector API démarrée sur http://localhost:${port}`);
});
