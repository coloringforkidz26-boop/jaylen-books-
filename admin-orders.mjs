// Admin only: list every order and move orders to the next step.
import { store, getOrder, saveOrder, isAdmin, json, STATUSES } from "../lib/orders.mjs";

export default async (req) => {
  if (!isAdmin(req)) return json({ error: "Wrong admin password" }, 401);

  if (req.method === "GET") {
    const s = store();
    const { blobs } = await s.list({ prefix: "orders/" });
    const orders = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })))).filter(Boolean);
    orders.sort((a, b) => (a.created < b.created ? 1 : -1));
    return json({ orders });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    const order = await getOrder(String(body.number || "").toUpperCase());
    if (!order) return json({ error: "Order not found" }, 404);
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return json({ error: "Unknown status" }, 400);
      if (body.status !== order.status) {
        order.status = body.status;
        order.history = [...(order.history || []), { status: body.status, at: new Date().toISOString() }];
      }
    }
    if (body.tracking !== undefined) order.tracking = String(body.tracking).trim().slice(0, 500);
    if (body.note !== undefined) order.note = String(body.note).slice(0, 2000);
    await saveOrder(order);
    return json({ order });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/admin/orders" };
