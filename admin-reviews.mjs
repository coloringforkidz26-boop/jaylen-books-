// Admin only: see every review and approve, hide or delete them.
import { rstore, allReviews } from "../lib/reviews.mjs";
import { isAdmin, json } from "../lib/orders.mjs";

export default async (req) => {
  if (!isAdmin(req)) return json({ error: "Wrong admin password" }, 401);
  if (req.method === "GET") return json({ reviews: await allReviews() });
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    const id = String(body.id || "");
    if (!/^[0-9]{14}-[0-9a-f]{8}$/.test(id)) return json({ error: "Unknown review" }, 400);
    const s = rstore(), r = await s.get("r/" + id, { type: "json" });
    if (!r) return json({ error: "Review not found" }, 404);
    if (body.action === "delete") { await s.delete("r/" + id); return json({ deleted: id }); }
    if (body.action === "approve") r.status = "approved";
    else if (body.action === "hide") r.status = "hidden";
    else return json({ error: "Unknown action" }, 400);
    await s.setJSON("r/" + id, r);
    return json({ review: r });
  }
  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/admin/reviews" };
