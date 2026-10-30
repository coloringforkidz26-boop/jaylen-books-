// Shared order helpers: Stripe lookups and order storage in Netlify Blobs.
import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

export const STATUSES = ["received", "printing", "shipped", "delivered", "canceled"];

export function store() {
  return getStore({ name: "orders", consistency: "strong" });
}

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set in Netlify");
  return new Stripe(key);
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// The same Stripe checkout always gets the same order number, so the
// webhook and the thank-you page can never create two different orders.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function orderNumberFor(sessionId) {
  const h = createHash("sha256").update(sessionId).digest();
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[h[i] % ALPHABET.length];
  return "JJB-" + s;
}

export async function getOrder(number) {
  return store().get("orders/" + number, { type: "json" });
}

export async function saveOrder(order) {
  await store().setJSON("orders/" + order.number, order);
}

export async function orderFromSession(sessionId) {
  const number = orderNumberFor(sessionId);
  const existing = await getOrder(number);
  if (existing) return existing;

  const s = stripe();
  const session = await s.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return null;
  const items = await s.checkout.sessions.listLineItems(sessionId, { limit: 100 });
  const ship = (session.collected_information && session.collected_information.shipping_details) || session.shipping_details || null;
  const cd = session.customer_details || {};
  const now = new Date().toISOString();
  const order = {
    number,
    sessionId,
    created: session.created ? new Date(session.created * 1000).toISOString() : now,
    email: cd.email || "",
    name: (ship && ship.name) || cd.name || "",
    phone: cd.phone || "",
    address: (ship && ship.address) || cd.address || null,
    items: items.data.map((li) => ({ name: li.description, quantity: li.quantity, amount: li.amount_total })),
    total: session.amount_total,
    currency: session.currency,
    discount: (session.total_details && session.total_details.amount_discount) || 0,
    shippingCost: (session.total_details && session.total_details.amount_shipping) || 0,
    status: "received",
    tracking: "",
    history: [{ status: "received", at: now }],
  };
  const again = await getOrder(number);
  if (again) return again;
  await saveOrder(order);
  return order;
}

// What a customer is allowed to see: no address, no email, no phone.
export function publicView(o) {
  return {
    number: o.number,
    created: o.created,
    status: o.status,
    history: o.history || [],
    tracking: o.tracking || "",
    items: o.items || [],
    total: o.total,
    currency: o.currency,
    firstName: (o.name || "").split(" ")[0],
  };
}

export function isAdmin(req) {
  const key = process.env.ADMIN_KEY || "";
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!key || !got) return false;
  const a = Buffer.from(key), b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}
