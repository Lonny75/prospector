import { PrismaClient } from "@prisma/client";
import {
  saasB2bPersona,
  immobilierPersona,
  assurancePersona,
  industriePersona,
  retailPersona,
  debutantLevel,
  intermediaireLevel,
  expertLevel,
  decouverteFormat,
  closingFormat,
  relanceFormat,
} from "@prospector/prompts";

const prisma = new PrismaClient();

const SECTORS = [
  { slug: "saas-b2b", label: "SaaS B2B", description: "Vente de logiciels en abonnement à des entreprises", persona: saasB2bPersona },
  { slug: "immobilier", label: "Immobilier", description: "Vente de produits/services aux agences et professionnels de l'immobilier", persona: immobilierPersona },
  { slug: "assurance", label: "Assurance", description: "Vente de produits/services aux courtiers et compagnies d'assurance", persona: assurancePersona },
  { slug: "industrie", label: "Industrie", description: "Vente de matériel/services aux sites de production industrielle", persona: industriePersona },
  { slug: "retail", label: "Retail", description: "Vente de produits/services aux enseignes et chaînes de magasins", persona: retailPersona },
];

const OBJECTION_LEVELS = [debutantLevel, intermediaireLevel, expertLevel];
const CALL_FORMATS = [decouverteFormat, closingFormat, relanceFormat];

/** Données de référence pour le catalogue (secteurs/personas/niveaux/formats) — pas des données de test. */
async function main() {
  const sectorIds: Record<string, string> = {};
  const personaIds: Record<string, string> = {};

  for (const s of SECTORS) {
    const sector = await prisma.sector.upsert({
      where: { slug: s.slug },
      update: { label: s.label, description: s.description },
      create: { slug: s.slug, label: s.label, description: s.description },
    });
    sectorIds[s.slug] = sector.id;

    const persona = await prisma.persona.upsert({
      where: { id: `seed-persona-${s.slug}` },
      update: {
        name: s.persona.name,
        baseSystemPromptFragment: s.persona.baseSystemPromptFragment,
        elevenlabsVoiceId: s.persona.elevenlabsVoiceId,
      },
      create: {
        id: `seed-persona-${s.slug}`,
        sectorId: sector.id,
        name: s.persona.name,
        baseSystemPromptFragment: s.persona.baseSystemPromptFragment,
        elevenlabsVoiceId: s.persona.elevenlabsVoiceId,
      },
    });
    personaIds[s.slug] = persona.id;
  }

  const objectionLevelIds: Record<string, string> = {};
  for (const level of OBJECTION_LEVELS) {
    const row = await prisma.objectionLevel.upsert({
      where: { slug: level.slug },
      update: { label: level.label, systemPromptFragment: level.systemPromptFragment },
      create: { slug: level.slug, label: level.label, systemPromptFragment: level.systemPromptFragment },
    });
    objectionLevelIds[level.slug] = row.id;
  }

  const callFormatIds: Record<string, string> = {};
  for (const format of CALL_FORMATS) {
    const row = await prisma.callFormat.upsert({
      where: { slug: format.slug },
      update: {
        label: format.label,
        targetDurationSeconds: format.targetDurationSeconds,
        systemPromptFragment: format.systemPromptFragment,
      },
      create: {
        slug: format.slug,
        label: format.label,
        targetDurationSeconds: format.targetDurationSeconds,
        systemPromptFragment: format.systemPromptFragment,
      },
    });
    callFormatIds[format.slug] = row.id;
  }

  const testUser = await prisma.user.upsert({
    where: { email: "test@prospector.local" },
    update: {},
    create: {
      email: "test@prospector.local",
      name: "Utilisateur de test",
      role: "rep",
    },
  });

  console.log("Seed terminé :", {
    sectorIds,
    personaIds,
    objectionLevelIds,
    callFormatIds,
    userId: testUser.id,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
