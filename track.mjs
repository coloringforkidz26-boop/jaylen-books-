// Customers look up their order with the order number and their email.
import { getOrder, publicView, json } from "../lib/orders.mjs";

export default async (req) => {
  const p = new URL(req.url).searchParams;
  const number = (p.get("number") || "").trim().toUpperCase();
  const email = (p.get("email") || "").trim().toLowerCase();
  if (!/^JJB-[A-Z0-9]{6}$/.test(number) || !email) return json({ error: "Enter your order number (like JJB-AB12CD) and the email you used at checkout." }, 400);
  const order = await getOrder(number);
  if (!order || (order.email || "").toLowerCase() !== email) {
    return json({ error: "We couldn't find an order with that number and email. Check both and try again." }, 404);
  }
  return json(publicView(order));
};

export const config = { path: "/api/track" };
