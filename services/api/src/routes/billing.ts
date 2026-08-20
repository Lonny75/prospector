import { Router, type Request, type Response } from "express";
import { prisma } from "../config/db.js";
import { stripe, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET } from "../config/stripe.js";
import { requireManager } from "../middleware/requireManager.js";

const WEB_APP_URL = process.env.FRONTEND_URL ?? "http://localhost:3311";

export const billingRouter = Router();
billingRouter.use(requireManager);

billingRouter.post("/checkout", async (req, res) => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: req.organizationId } });
  const seats = Math.max(1, Number((req.body as { seats?: number }).seats) || 1);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: org.stripeCustomerId ?? undefined,
    client_reference_id: org.id,
    line_items: [{ price: STRIPE_PRICE_ID, quantity: seats }],
    subscription_data: { trial_period_days: 14 },
    success_url: `${WEB_APP_URL}/dashboard/billing?checkout=success`,
    cancel_url: `${WEB_APP_URL}/dashboard/billing?checkout=cancelled`,
  });

  res.json({ url: session.url });
});

billingRouter.post("/portal", async (req, res) => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: req.organizationId } });
  if (!org.stripeCustomerId) {
    res.status(404).json({ error: "Aucun abonnement à gérer pour le moment" });
    return;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${WEB_APP_URL}/dashboard/billing`,
  });

  res.json({ url: session.url });
});

/**
 * Monté séparément dans index.ts, AVANT express.json() : Stripe exige le corps brut (non parsé)
 * pour vérifier la signature de la requête. Pas de requireAuth/requireManager ici — Stripe appelle
 * ce endpoint directement, l'authenticité vient de la signature, pas d'un JWT.
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.header("stripe-signature");
  if (!signature) {
    res.status(400).send("Signature manquante");
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Signature de webhook Stripe invalide", err);
    res.status(400).send("Signature invalide");
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const organizationId = session.client_reference_id;
        if (organizationId && session.customer && session.subscription) {
          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
            },
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const org = await prisma.organization.findUnique({ where: { stripeSubscriptionId: subscription.id } });
        if (org) {
          await prisma.organization.update({
            where: { id: org.id },
            data: {
              subscriptionStatus: subscription.status,
              seatsPurchased: subscription.items.data[0]?.quantity ?? org.seatsPurchased,
              trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
              plan: "starter",
            },
          });
        }
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error(`Erreur de traitement du webhook Stripe (${event.type})`, err);
    res.status(500).send("Erreur de traitement du webhook");
  }
}
