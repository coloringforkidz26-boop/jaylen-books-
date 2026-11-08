// Every night at about 9 pm Eastern: email the owner a summary of the day's orders.
// Needs RESEND_API_KEY in Netlify (free account at resend.com). ORDER_EMAIL_TO is optional.
import { store } from "../lib/orders.mjs";

const money = (cents) => "$" + ((cents || 0) / 100).toFixed(2);
const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const addr = (a) => (a ? [a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "");
const items = (o) => (o.items || []).map((i) => `${i.quantity} × ${i.name}`).join(", ");

async function allOrders() {
  const s = store();
  const { blobs } = await s.list({ prefix: "orders/" });
  const list = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })))).filter(Boolean);
  return list.sort((a, b) => (a.created < b.created ? 1 : -1));
}

async function pendingReviews() {
  try {
    const { getStore } = await import("@netlify/blobs");
    const s = getStore({ name: "reviews", consistency: "strong" });
    const { blobs } = await s.list({ prefix: "r/" });
    const list = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })));
    return list.filter((r) => r && r.status === "pending").length;
  } catch {
    return 0;
  }
}

function card(o) {
  return `<tr><td style="padding:12px 14px;border-bottom:1px solid #f1d9bd;vertical-align:top">
    <div style="font-weight:700;color:#1C2340">${esc(o.number)} · ${money(o.total)}</div>
    <div style="color:#3a2418">${esc(items(o))}</div>
    <div style="color:#7a5a48;font-size:13px;margin-top:4px">${esc(o.name)}${o.email ? " · " + esc(o.email) : ""}</div>
    <div style="color:#7a5a48;font-size:13px">${esc(addr(o.address))}</div>
    ${o.giftNote ? `<div style="margin-top:6px;background:#fff1c9;border-radius:8px;padding:6px 10px;font-size:13px">🎁 Gift note: ${esc(o.giftNote)}</div>` : ""}
  </td></tr>`;
}

export default async () => {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log("daily-orders: RESEND_API_KEY is not set, skipping");
    return;
  }
  const to = process.env.ORDER_EMAIL_TO || "coloringforkidz26@gmail.com";
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const orders = await allOrders();
  const today = orders.filter((o) => Date.parse(o.created) >= since && o.status !== "canceled");
  const toShip = orders.filter((o) => o.status === "received" || o.status === "printing");
  const revenue = today.reduce((s, o) => s + (o.total || 0), 0);
  const books = today.reduce((s, o) => s + (o.items || []).reduce((n, i) => n + (i.quantity || 0), 0), 0);
  const reviews = await pendingReviews();
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });

  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#3a2418">
    <div style="height:8px;background:linear-gradient(90deg,#ff6b8b,#ff7a3d,#ffc93c,#13b3a3,#9b6cf0);border-radius:4px"></div>
    <h1 style="color:#e2552b;font-size:24px;margin:18px 0 4px">Today's orders 📚</h1>
    <div style="color:#7a5a48">${esc(date)}</div>
    <table style="width:100%;margin:16px 0;border-collapse:collapse"><tr>
      <td style="background:#fff1c9;border-radius:10px;padding:12px;text-align:center"><div style="font-size:26px;font-weight:700">${today.length}</div>new orders</td>
      <td style="width:10px"></td>
      <td style="background:#d6f5ef;border-radius:10px;padding:12px;text-align:center"><div style="font-size:26px;font-weight:700">${books}</div>books</td>
      <td style="width:10px"></td>
      <td style="background:#ffe1d2;border-radius:10px;padding:12px;text-align:center"><div style="font-size:26px;font-weight:700">${money(revenue)}</div>sales</td>
    </tr></table>
    ${today.length ? `<h2 style="font-size:18px;color:#1C2340">New orders</h2><table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #f1d9bd;border-radius:10px">${today.map(card).join("")}</table>` : `<p>No new orders today. Tomorrow's a new day! 💪</p>`}
    ${toShip.length ? `<h2 style="font-size:18px;color:#1C2340;margin-top:22px">Still to ship (${toShip.length})</h2><ul style="padding-left:18px">${toShip.map((o) => `<li>${esc(o.number)}: ${esc(items(o))} → ${esc(o.name)}</li>`).join("")}</ul>` : `<p style="color:#1E8C4E;font-weight:700">Everything is shipped. ✅</p>`}
    ${reviews ? `<p style="background:#fff1c9;border-radius:10px;padding:10px 14px">⭐ ${reviews} new review${reviews === 1 ? "" : "s"} waiting for your approval in the admin panel.</p>` : ""}
    <p style="color:#7a5a48;font-size:13px;margin-top:24px">Open your admin panel at coloringforkidz.net to update orders.</p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + key, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.ORDER_EMAIL_FROM || "Coloring for Kidz <onboarding@resend.dev>",
      to: [to],
      subject: `📚 ${today.length} new order${today.length === 1 ? "" : "s"} today · ${money(revenue)}`,
      html,
    }),
  });
  console.log("daily-orders: email status", res.status, await res.text());
};

// 2:00 UTC = 9 pm Eastern in winter (10 pm in summer).
export const config = { schedule: "0 2 * * *" };
