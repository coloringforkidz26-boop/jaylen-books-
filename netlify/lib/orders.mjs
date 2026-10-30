// The thank-you popup calls this right after checkout to get the order number.
import { orderFromSession, publicView, json } from "../lib/orders.mjs";

export default async (req) => {
  const id = new URL(req.url).searchParams.get("session_id") || "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json({ error: "Missing checkout id" }, 400);
  try {
    const order = await orderFromSession(id);
    if (!order) return json({ error: "Payment is not finished yet" }, 409);
    return json(publicView(order));
  } catch (e) {
    return json({ error: "Could not look up this order" }, 500);
  }
};

export const config = { path: "/api/order" };
