// Customer reviews stored in Netlify Blobs. New reviews wait for the owner's approval.
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";

export function rstore() {
  return getStore({ name: "reviews", consistency: "strong" });
}

export async function allReviews() {
  const s = rstore();
  const { blobs } = await s.list({ prefix: "r/" });
  const list = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })))).filter(Boolean);
  list.sort((a, b) => (a.created < b.created ? 1 : -1));
  return list;
}

export function publicView(r) {
  return { id: r.id, name: r.name, book: r.book, rating: r.rating, text: r.text, created: r.created };
}

export function newId() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + randomBytes(4).toString("hex");
}
