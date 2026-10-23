// Contact form: saves each enquiry to the LEADS KV namespace (key lead:<time>:<id>) and emails Kartik.
// POST form fields: name, business, website, contact, message, company (honeypot)

const hits = new Map();

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  let f;
  try {
    const type = request.headers.get("content-type") || "";
    f = type.includes("application/json") ? await request.json() : Object.fromEntries(await request.formData());
  } catch { return json({ ok: false, error: "Couldn't read the form." }, 400); }

  if (f.company) return json({ ok: true }); // bots fill the hidden field; pretend success
  if (limited(ip)) return json({ ok: false, error: "Too many messages. Please email instead." }, 429);

  const lead = {
    source: "contact-form",
    name: clip(f.name, 80),
    business: clip(f.business, 120),
    website: clip(f.website, 200),
    contact: clip(f.contact, 120),
    message: clip(f.message, 2000),
    at: new Date().toISOString(),
  };
  if (!lead.name || !lead.contact) return json({ ok: false, error: "Please add your name and an email or phone number." }, 400);

  if (!(await saveLead(env, lead))) return json({ ok: false, error: "Couldn't save your message. Please email instead." }, 500);
  return json({ ok: true });
}

export function onRequest() {
  return json({ ok: false, error: "Use POST." }, 405);
}

export async function saveLead(env, lead) {
  if (!env.LEADS) return false;
  const key = `lead:${lead.at}:${crypto.randomUUID().slice(0, 8)}`;
  await env.LEADS.put(key, JSON.stringify(lead), { expirationTtl: 60 * 60 * 24 * 365 });
  // Email Kartik through the private swoop-mailer Worker; the lead is already saved if this fails
  if (env.MAILER) {
    try { await env.MAILER.fetch("https://mailer/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(lead) }); } catch { /* best effort */ }
  }
  return true;
}

function limited(ip) {
  const now = Date.now(), win = 60 * 60 * 1000;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now);
  hits.set(ip, list);
  return list.length > 5;
}

const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
