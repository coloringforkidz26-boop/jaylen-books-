// Admin only: book stock counts. The page subtracts website orders automatically.
import { getStore } from "@netlify/blobs";
import { isAdmin, json } from "../lib/orders.mjs";

const st = () => getStore({ name: "stock", consistency: "strong" });

export default async (req) => {
  if (!isAdmin(req)) return json({ error: "Wrong admin password" }, 401);
  const s = st();
  const levels = (await s.get("levels", { type: "json" })) || {};

  if (req.method === "GET") return json({ levels });

  if (req.method === "POST") {
    let b;
    try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    const id = String(b.book || "");
    if (!/^[a-z0-9-]{1,60}$/.test(id)) return json({ error: "Unknown book" }, 400);
    const n = Math.round(Number(b.amount));
    if (!Number.isFinite(n) || Math.abs(n) > 100000) return json({ error: "Please type a number" }, 400);
    const now = new Date().toISOString();
    const cur = levels[id] || { count: 0, setAt: now, log: [] };
    if (b.action === "set") {
      if (n < 0) return json({ error: "Stock can't be below 0" }, 400);
      cur.count = n; cur.setAt = now;
    } else if (b.action === "add") {
      cur.count += n;
    } else return json({ error: "Unknown action" }, 400);
    cur.log = [{ at: now, action: b.action, amount: n, note: String(b.note || "").slice(0, 120) }, ...(cur.log || [])].slice(0, 50);
    levels[id] = cur;
    await s.setJSON("levels", levels);
    return json({ levels });
  }
  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/admin/stock" };
