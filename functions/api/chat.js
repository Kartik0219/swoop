// AI assistant for swoopsites.com (Cloudflare Workers AI). Answers only from the facts below.
// POST { messages: [{ role: "user"|"assistant", content }] } -> { reply }
import { saveLead } from "./contact.js";

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const hits = new Map();

const FACTS = `
Swoop Sites builds and looks after websites for local small businesses across south-east Melbourne (Dandenong, Springvale, Keysborough, Clayton, Mulgrave, Narre Warren, Berwick, Cranbourne and nearby). Run by Kartik Panikar, a web developer based in Melbourne who is finishing a Master of Cybersecurity at La Trobe University (Bachelor of IT, RMIT). Sole trader, ABN 88 329 296 713. Everything is handled by email.
PRICES (AUD, fixed and agreed in writing first):
- New website: $499 one-off. Up to 5 pages, mobile-first, domain + HTTPS + email setup, contact/booking/quote form, Google Business Profile setup, Google basics and click-to-call, words written for you.
- Website upgrade (tune-up of an existing small site): $199 one-off. Faster pages, phone layout fixes, HTTPS padlock + http redirect, contact form checked, footer/details updated, speed score before and after. If they later want a new site, the $199 comes off the $499.
- Bigger sites, online payments, shops or more than 5 pages: fixed quote first.
- Founding client offer: the first 3 clients get 20% off the build price in exchange for an honest Google review.
- Optional monthly care plans, billed monthly from launch, month-to-month, cancel with 30 days' notice: Care Basic $99/mo (hosting, HTTPS kept valid, daily backups, software updates, uptime monitoring, up to 30 min edits). Care Plus $129/mo (Basic + monthly security check and report, email protection SPF/DKIM/DMARC, up to 1 hour edits). Care Pro $249/mo (Plus + bookings and payments managed, priority support).
PROCESS: free homepage mockup first with no obligation; 50% deposit only once they like the design; 50% when the site goes live; paid by bank transfer. Usually live in about 2 weeks, depending on how fast the client sends logo, photos and feedback. Client needs: logo, 5-10 photos, a few answers, domain access. Kartik writes the words.
OWNERSHIP: domain registered in the client's name; content is theirs; if they leave, Kartik hands everything over.
GOOGLE: no one can guarantee rankings; Kartik gets the basics right (titles, fast mobile site, Search Console, Business Profile link).
CONTACT: email kartikp.work@gmail.com, or the contact form on this page. Kartik replies by email, usually within a day.
`;

const SYSTEM = `You are the Swoop Sites website assistant, an AI. Be friendly, brief (2-4 short sentences), plain Australian English.
Answer ONLY using the facts below. If something isn't covered (exact timelines for a specific job, custom features, discounts beyond those listed, technical promises), say Kartik will confirm and suggest leaving a name and email or phone. Never invent prices, guarantees, clients, reviews or features. Never claim to be human. Don't give legal, tax or security advice beyond the listed services.
When someone seems interested, offer the free homepage mockup and ask for their name, business and best email or phone so Kartik can get back to them.
FACTS:${FACTS}`;

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (limited(ip)) return json({ reply: "I've had a lot of questions from you in a short time. Please email kartikp.work@gmail.com and Kartik will help." }, 429);
  if (!env.AI) return json({ reply: "The assistant is offline right now. Please email kartikp.work@gmail.com." }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ reply: "Sorry, I didn't catch that." }, 400); }
  const history = (Array.isArray(body && body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));
  if (!history.length || history[history.length - 1].role !== "user") return json({ reply: "Ask me anything about Swoop Sites." }, 400);

  // Save contact details if the visitor shares an email or phone number
  const userText = history.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const contact = (userText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || userText.match(/(\+?61|0)[\d\s-]{8,12}\d/) || [])[0];
  if (contact) {
    try { await saveLead(env, { source: "chat", contact, message: userText.slice(0, 2000), at: new Date().toISOString() }); } catch { /* best effort */ }
  }

  try {
    const out = await env.AI.run(MODEL, { messages: [{ role: "system", content: SYSTEM }, ...history], max_tokens: 280, temperature: 0.3 });
    const reply = (out && out.response ? out.response : "").trim() || "Sorry, I'm not sure. Kartik can help: kartikp.work@gmail.com.";
    return json({ reply, saved: !!contact });
  } catch {
    return json({ reply: "The assistant had a hiccup. Please email kartikp.work@gmail.com and Kartik will reply." }, 502);
  }
}

export function onRequest() {
  return json({ reply: "Use POST." }, 405);
}

function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now);
  hits.set(ip, list);
  return list.length > 30;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
