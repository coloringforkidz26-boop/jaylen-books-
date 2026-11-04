// Public: read approved reviews, or send a new review (it waits for approval).
import { rstore, allReviews, publicView, newId } from "../lib/reviews.mjs";
import { json } from "../lib/orders.mjs";

const clean = (v, max) => String(v || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export default async (req) => {
  if (req.method === "GET") {
    const list = (await allReviews()).filter((r) => r.status === "approved").map(publicView);
    return json({ reviews: list });
  }
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    if (body.website) return json({ ok: true }); // bots fill the hidden field
    const text = clean(body.text, 800), name = clean(body.name, 40), book = clean(body.book, 60);
    const rating = Math.round(Number(body.rating));
    if (text.length < 10) return json({ error: "Please write a little more (at least a sentence)." }, 400);
    if (!(rating >= 1 && rating <= 5)) return json({ error: "Please pick 1 to 5 stars." }, 400);
    const pending = (await allReviews()).filter((r) => r.status === "pending");
    if (pending.length > 300) return json({ error: "We have a lot of reviews waiting. Please try again later." }, 429);
    const r = { id: newId(), name: name || "A happy customer", book, rating, text, status: "pending", created: new Date().toISOString() };
    await rstore().setJSON("r/" + r.id, r);
    return json({ ok: true });
  }
  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/reviews" };
