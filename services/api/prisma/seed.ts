import { PrismaClient } from "@prisma/client";
import { saasB2bPersona, debutantLevel, expertLevel, decouverteFormat } from "@prospector/prompts";

const prisma = new PrismaClient();

/** Données d'exemple pour tester le pipeline de bout en bout (Phase 0/1) — pas pour la production. */
async function main() {
  const sector = await prisma.sector.upsert({
    where: { slug: "saas-b2b" },
    update: {},
    create: {
      slug: "saas-b2b",
      label: "SaaS B2B",
      description: "Vente de logiciels en abonnement à des entreprises",
    },
  });

  const persona = await prisma.persona.upsert({
    where: { id: "seed-persona-saas-b2b-marc" },
    update: {},
    create: {
      id: "seed-persona-saas-b2b-marc",
      sectorId: sector.id,
      name: saasB2bPersona.name,
      baseSystemPromptFragment: saasB2bPersona.baseSystemPromptFragment,
      elevenlabsVoiceId: saasB2bPersona.elevenlabsVoiceId,
    },
  });

  const objectionDebutant = await prisma.objectionLevel.upsert({
    where: { slug: debutantLevel.slug },
    update: {},
    create: {
      slug: debutantLevel.slug,
      label: debutantLevel.label,
      systemPromptFragment: debutantLevel.systemPromptFragment,
    },
  });

  await prisma.objectionLevel.upsert({
    where: { slug: expertLevel.slug },
    update: {},
    create: {
      slug: expertLevel.slug,
      label: expertLevel.label,
      systemPromptFragment: expertLevel.systemPromptFragment,
    },
  });

  const callFormat = await prisma.callFormat.upsert({
    where: { slug: decouverteFormat.slug },
    update: {},
    create: {
      slug: decouverteFormat.slug,
      label: decouverteFormat.label,
      targetDurationSeconds: decouverteFormat.targetDurationSeconds,
      systemPromptFragment: decouverteFormat.systemPromptFragment,
    },
  });

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
    sectorId: sector.id,
    personaId: persona.id,
    objectionLevelId: objectionDebutant.id,
    callFormatId: callFormat.id,
    userId: testUser.id,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
