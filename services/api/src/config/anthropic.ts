import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY manquant dans l'environnement");
}

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const CLAUDE_PROSPECT_MODEL = "claude-sonnet-5";
export const CLAUDE_DEBRIEF_MODEL = "claude-opus-4-8";
export const CLAUDE_VALIDATION_MODEL = "claude-haiku-4-5-20251001";
