// Free website check: a quick, read-only look at a site's public homepage (one or two requests).
// POST { url } -> { host, score, checks: [{ id, label, pass, detail }] }

const TIMEOUT_MS = 8000;
const hits = new Map(); // best-effort per-IP rate limit (per isolate)

export async function onRequestPost({ request }) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (limited(ip)) return json({ error: "Too many checks. Try again in a few minutes." }, 429);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Send a website address." }, 400); }
  const host = cleanHost(body && body.url);
  if (!host) return json({ error: "That doesn't look like a public website address (e.g. yourbusiness.com.au)." }, 400);

  const checks = [];
  const started = Date.now();
  let res = null, html = "";
  try {
    res = await timedFetch(`https://${host}/`, { redirect: "follow" });
    html = (await res.text()).slice(0, 400000);
  } catch {
    checks.push(item("https", "Secure connection (HTTPS)", false, "The site didn't load over HTTPS. Visitors may see a \"Not secure\" warning, or the certificate may be missing or expired."));
    return json(result(host, checks));
  }
  const ms = Date.now() - started;

  checks.push(item("https", "Secure connection (HTTPS)", res.ok || res.status < 500,
    res.ok ? "The site loads over HTTPS with a valid certificate." : `The site answered with an error (${res.status}).`));

  let redirects = false;
  try {
    const plain = await timedFetch(`http://${host}/`, { redirect: "manual" });
    const loc = plain.headers.get("location") || "";
    redirects = plain.status >= 300 && plain.status < 400 && loc.startsWith("https://");
  } catch { /* port 80 closed counts as not redirecting */ }
  checks.push(item("redirect", "Sends visitors to the secure version", redirects,
    redirects ? "http:// visitors are sent to https:// automatically." : "Typing the address without https can leave visitors on an insecure page."));

  const h = res.headers;
  const hsts = !!h.get("strict-transport-security");
  checks.push(item("hsts", "Forces HTTPS in browsers (HSTS)", hsts,
    hsts ? "Browsers are told to always use the secure version." : "Missing. Browsers aren't told to always use HTTPS."));
  const headers = ["content-security-policy", "x-frame-options", "x-content-type-options"].filter((k) => h.get(k));
  checks.push(item("headers", "Security headers", headers.length >= 2,
    headers.length >= 2 ? "Key protective headers are in place." : `Only ${headers.length} of 3 key protective headers found (helps block clickjacking and script attacks).`));

  const viewport = /<meta[^>]+name=["']?viewport/i.test(html);
  checks.push(item("mobile", "Set up for phones", viewport,
    viewport ? "The page is set up to fit phone screens." : "No mobile viewport tag, so the page may look tiny or zoomed out on phones."));

  const leak = (h.get("x-powered-by") || "") + " " + ((html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i) || [])[1] || "");
  const leaksVersion = /\d+\.\d+/.test(leak);
  checks.push(item("version", "Hides software versions", !leaksVersion,
    leaksVersion ? `The site advertises its software version (${leak.trim().slice(0, 60)}), which helps attackers find known holes.` : "No software version numbers on show."));

  const kb = Math.round(html.length / 1024);
  const fast = ms < 1500;
  checks.push(item("speed", "Loads quickly", fast,
    fast ? `The page responded in ${(ms / 1000).toFixed(1)}s.` : `The page took ${(ms / 1000).toFixed(1)}s to respond (${kb} KB of HTML). Slow sites lose visitors.`));

  return json(result(host, checks));
}

export function onRequest() {
  return json({ error: "Use POST." }, 405);
}

function cleanHost(input) {
  if (typeof input !== "string") return null;
  let s = input.trim().toLowerCase();
  if (!s || s.length > 253) return null;
  if (!/^https?:\/\//.test(s)) s = "https://" + s;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.port || u.username || u.password) return null;
  const host = u.hostname.replace(/\.$/, "");
  if (!/^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return null; // names only, no IPs
  if (/(^|\.)(localhost|local|internal|lan|home|corp|test|invalid|example)$/.test(host)) return null;
  return host;
}

async function timedFetch(url, opts) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal, headers: { "user-agent": "SwoopSites-FreeCheck/1.0 (+https://swoopsites.com)" } });
  } finally { clearTimeout(t); }
}

function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now);
  hits.set(ip, list);
  return list.length > 10;
}

const item = (id, label, pass, detail) => ({ id, label, pass: !!pass, detail });
const result = (host, checks) => ({ host, score: checks.filter((c) => c.pass).length, total: checks.length, checks });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
