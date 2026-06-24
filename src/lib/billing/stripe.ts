import "server-only";

import Stripe from "stripe";
import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const stripeEnvSchema = z.object({
  STRIPE_SECRET_KEY: optionalNonEmptyString,
  STRIPE_WEBHOOK_SECRET: optionalNonEmptyString,
});

export type StripeBillingConfig = {
  secretKey?: string;
  webhookSecret?: string;
};

export function getStripeBillingConfig(): StripeBillingConfig {
  const parsed = stripeEnvSchema.parse({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  });
  return {
    secretKey: parsed.STRIPE_SECRET_KEY,
    webhookSecret: parsed.STRIPE_WEBHOOK_SECRET,
  };
}

export function requireStripeSecretKey(): string {
  const key = getStripeBillingConfig().secretKey;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEYが設定されていません。");
  }
  return key;
}

export function requireStripeWebhookSecret(): string {
  const secret = getStripeBillingConfig().webhookSecret;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRETが設定されていません。");
  }
  return secret;
}

export function createStripeClient(): Stripe {
  return new Stripe(requireStripeSecretKey());
}
