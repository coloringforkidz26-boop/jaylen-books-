// Admin only: money in and money out (with receipt photos/PDFs), stored in Netlify Blobs.
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { isAdmin, json } from "../lib/orders.mjs";

const st = () => getStore({ name: "expenses", consistency: "strong" });
const CATS = ["Author copies & printing", "Shipping & postage", "Packaging & supplies", "Ads & marketing", "Equipment", "Software & website", "Event & booth fees", "Other"];
const INCOME_CATS = ["Amazon KDP royalties", "In-person & cash sales", "Church & bulk orders", "Other income"];
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const clean = (v, max) => String(v || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

async function list() {
  const s = st();
  const { blobs } = await s.list({ prefix: "e/" });
  const all = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })))).filter(Boolean);
  return all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.created < b.created ? 1 : -1));
}

export default async (req) => {
  if (!isAdmin(req)) return json({ error: "Wrong admin password" }, 401);
  const url = new URL(req.url);
  const s = st();

  if (req.method === "GET") {
    const rid = url.searchParams.get("receipt");
    if (rid) {
      if (!/^[0-9a-f]{16}$/.test(rid)) return json({ error: "Bad receipt" }, 400);
      const e = await s.get("e/" + rid, { type: "json" });
      const data = await s.get("r/" + rid, { type: "arrayBuffer" });
      if (!e || !data) return json({ error: "Receipt not found" }, 404);
      return new Response(data, { headers: { "content-type": e.receiptType || "application/octet-stream", "cache-control": "no-store" } });
    }
    return json({ expenses: await list(), categories: CATS, incomeCategories: INCOME_CATS });
  }

  if (req.method === "POST") {
    let b;
    try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    const amount = Math.round(Number(String(b.amount).replace(/[$,]/g, "")) * 100);
    if (!(amount > 0 && amount < 10000000)) return json({ error: "Please type the amount, like 24.99" }, 400);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : new Date().toISOString().slice(0, 10);
    const id = randomBytes(8).toString("hex");
    const kind = b.kind === "income" ? "income" : "expense";
    const cats = kind === "income" ? INCOME_CATS : CATS;
    const e = {
      id, date, amount, kind,
      category: cats.includes(b.category) ? b.category : cats[cats.length - 1],
      what: clean(b.what, 120) || (kind === "income" ? "Money made" : "Expense"),
      note: clean(b.note, 400),
      receiptType: "", receiptName: "",
      created: new Date().toISOString(),
    };
    if (b.receipt && b.receipt.data) {
      const type = String(b.receipt.type || "");
      if (!TYPES[type]) return json({ error: "Receipts can be a photo (JPG, PNG) or a PDF." }, 400);
      const buf = Buffer.from(String(b.receipt.data), "base64");
      if (buf.length > 4.2 * 1024 * 1024) return json({ error: "That receipt file is too big. Try a photo or a smaller PDF (under 4 MB)." }, 413);
      await s.set("r/" + id, buf);
      e.receiptType = type;
      e.receiptName = (date + "-" + e.what).replace(/[^a-z0-9-]+/gi, "-").slice(0, 60) + "." + TYPES[type];
    }
    await s.setJSON("e/" + id, e);
    return json({ expense: e });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id") || "";
    if (!/^[0-9a-f]{16}$/.test(id)) return json({ error: "Bad id" }, 400);
    await s.delete("e/" + id);
    await s.delete("r/" + id);
    return json({ deleted: id });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/admin/expenses" };
