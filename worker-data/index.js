// Kerkdata Worker — leest/schrijft de liederen- en bijbel_hsv-cache in D1.
// Beveiliging: origin-lock (alleen de app-URL's) op alle verzoeken.
//  - lezen + losse writes: alleen origin-lock (geen sleutel in de openbare app)
//  - X-Admin-Key (ADMIN_SECRET): nodig voor de bulk-import (migratie)

const TABELLEN = new Set(["liederen", "bijbel_hsv"]);

function originToegestaan(origin) {
  if (!origin) return false;
  return origin === "https://tmvsb5797f-hub.github.io" ||
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1");
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    const pad = url.pathname.replace(/\/+$/, "");

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (!originToegestaan(origin)) {
      return new Response("Niet toegestaan", { status: 403 });
    }

    try {
      // --- LIEDEREN ---
      if (pad === "/liederen" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT id, tekst FROM liederen").all();
        const map = {};
        for (const r of results) map[r.id] = r.tekst;
        return json(map, 200, origin);
      }
      if (pad === "/liederen" && request.method === "POST") {
        // Alleen origin-gelockt (geen sleutel in de openbare app). Basale groottecheck
        // om misbruik te beperken.
        const { id, tekst } = await request.json();
        if (!id || typeof id !== "string" || id.length > 200 || typeof tekst !== "string" || tekst.length > 20000) return json({ error: "ongeldig" }, 400, origin);
        await env.DB.prepare("INSERT INTO liederen (id, tekst) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET tekst=excluded.tekst").bind(id, tekst).run();
        return json({ ok: true }, 200, origin);
      }

      // --- BIJBEL_HSV ---
      if (pad === "/bijbel_hsv" && request.method === "GET") {
        const id = url.searchParams.get("id");
        if (!id) return json({ error: "id ontbreekt" }, 400, origin);
        const row = await env.DB.prepare("SELECT tekst FROM bijbel_hsv WHERE id = ?").bind(id).first();
        if (!row) return json({ gevonden: false }, 404, origin);
        return json({ gevonden: true, tekst: row.tekst }, 200, origin);
      }
      if (pad === "/bijbel_hsv" && request.method === "POST") {
        const { id, tekst } = await request.json();
        if (!id || typeof id !== "string" || id.length > 200 || typeof tekst !== "string" || tekst.length > 20000) return json({ error: "ongeldig" }, 400, origin);
        await env.DB.prepare("INSERT INTO bijbel_hsv (id, tekst) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET tekst=excluded.tekst").bind(id, tekst).run();
        return json({ ok: true }, 200, origin);
      }

      // --- BULK IMPORT (migratie, admin) ---
      if (pad === "/bulk" && request.method === "POST") {
        if (request.headers.get("X-Admin-Key") !== env.ADMIN_SECRET) return json({ error: "geen toegang" }, 401, origin);
        const { table, rows } = await request.json();
        if (!TABELLEN.has(table) || !Array.isArray(rows)) return json({ error: "ongeldig" }, 400, origin);
        const stmt = env.DB.prepare(`INSERT INTO ${table} (id, tekst) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET tekst=excluded.tekst`);
        const batch = rows.filter(r => r && r.id && typeof r.tekst === "string").map(r => stmt.bind(r.id, r.tekst));
        if (batch.length) await env.DB.batch(batch);
        return json({ ok: true, ingevoerd: batch.length }, 200, origin);
      }

      // --- COUNT (verificatie) ---
      if (pad === "/count" && request.method === "GET") {
        const table = url.searchParams.get("table");
        if (!TABELLEN.has(table)) return json({ error: "ongeldig" }, 400, origin);
        const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first();
        return json({ table, count: row.n }, 200, origin);
      }

      return json({ error: "onbekend pad" }, 404, origin);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, origin);
    }
  },
};
