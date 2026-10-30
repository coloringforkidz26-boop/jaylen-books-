// Stripe calls this after every payment. It saves the order.
import { stripe, orderFromSession, json } from "../lib/orders.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ error: "STRIPE_WEBHOOK_SECRET is not set in Netlify" }, 500);
  const body = await req.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, req.headers.get("stripe-signature"), secret);
  } catch (e) {
    return json({ error: "Signature check failed" }, 400);
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await orderFromSession(event.data.object.id);
  }
  return json({ received: true });
};

export const config = { path: "/api/stripe-webhook" };
