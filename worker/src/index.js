// ─── Fondation Lefoulon-Delalande — Worker ──────────────────── v1 ────────────
// Sert les données Notion (actualités + suggestions) en direct, au même format
// que les JSON statiques d'assets/data. Port de scripts/notion-sync.mjs.
const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const CACHE_TTL = 3600; // 1 h — même cadence que le sync GitHub Actions

const CAT_MAP = {
  "Grand Prix": "prix",
  Bourse: "bourse",
  Appel: "appel",
  Evenement: "event",
};

// ─── Helpers HTTP ──────────────────────────────────────────────────────────────
function corsHeaders(env, request) {
  const origin = request?.headers.get("Origin") || "";
  const allowed = env.FRONT_URL || "http://localhost:5173";
  const isAllowed =
    origin === allowed ||
    origin === "https://www.fondation-lefoulon-delalande.fr" ||
    origin === "https://fondation-lefoulon-delalande.fr" ||
    origin.endsWith(".pages.dev") ||
    origin.startsWith("http://localhost");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, { status, headers: extraHeaders });
}

// ─── Notion API ────────────────────────────────────────────────────────────────
const notionHeaders = (env) => ({
  Authorization: `Bearer ${env.NOTION_TOKEN}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
});

async function notionGet(path, env) {
  const r = await fetch(`${NOTION_API}${path}`, { headers: notionHeaders(env) });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
}

async function notionPost(path, body, env) {
  const r = await fetch(`${NOTION_API}${path}`, {
    method: "POST",
    headers: notionHeaders(env),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}`);
  return r.json();
}

async function queryDB(dbId, env, filter = null, sorts = null) {
  const pages = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (sorts) body.sorts = sorts;
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;
    const data = await notionPost(`/databases/${dbId}/query`, body, env);
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return pages;
}

async function fetchBlocks(pageId, env) {
  try {
    const data = await notionGet(`/blocks/${pageId}/children?page_size=100`, env);
    return data.results;
  } catch (e) {
    console.warn(`fetchBlocks(${pageId}):`, e.message);
    return [];
  }
}

// ─── Helpers de transformation ─────────────────────────────────────────────────
const getText = (arr = []) => (arr || []).map((r) => r.plain_text).join("");

function formatDate(iso, lang) {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00Z");
    const locales = { fr: "fr-FR", en: "en-US" };
    return d.toLocaleDateString(locales[lang] || "fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function richToHTML(arr = []) {
  return (arr || [])
    .map((t) => {
      let s = (t.plain_text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      if (t.annotations?.bold) s = `<strong>${s}</strong>`;
      if (t.annotations?.italic) s = `<em>${s}</em>`;
      if (t.annotations?.code) s = `<code>${s}</code>`;
      if (t.href) s = `<a href="${t.href}">${s}</a>`;
      return s;
    })
    .join("");
}

function convertBlocksToHTML(blocks) {
  let html = "";
  let inUl = false,
    inOl = false;
  const close = () => {
    if (inUl) {
      html += "</ul>";
      inUl = false;
    }
    if (inOl) {
      html += "</ol>";
      inOl = false;
    }
  };
  for (const b of blocks) {
    switch (b.type) {
      case "paragraph": {
        close();
        const inner = richToHTML(b.paragraph.rich_text);
        if (inner.trim()) html += `<p>${inner}</p>`;
        break;
      }
      case "heading_1":
        close();
        html += `<h2>${richToHTML(b.heading_1.rich_text)}</h2>`;
        break;
      case "heading_2":
        close();
        html += `<h2>${richToHTML(b.heading_2.rich_text)}</h2>`;
        break;
      case "heading_3":
        close();
        html += `<h3>${richToHTML(b.heading_3.rich_text)}</h3>`;
        break;
      case "bulleted_list_item":
        if (!inUl) {
          close();
          html += "<ul>";
          inUl = true;
        }
        html += `<li>${richToHTML(b.bulleted_list_item.rich_text)}</li>`;
        break;
      case "numbered_list_item":
        if (!inOl) {
          close();
          html += "<ol>";
          inOl = true;
        }
        html += `<li>${richToHTML(b.numbered_list_item.rich_text)}</li>`;
        break;
      case "image": {
        close();
        const src =
          b.image.type === "external" ? b.image.external.url : b.image.file?.url || "";
        const alt = getText(b.image.caption);
        html +=
          `<figure><img src="${src}" alt="${alt}" loading="lazy">` +
          (alt ? `<figcaption>${alt}</figcaption>` : "") +
          `</figure>`;
        break;
      }
      case "quote":
        close();
        html += `<blockquote><p>${richToHTML(b.quote.rich_text)}</p></blockquote>`;
        break;
      case "divider":
        close();
        html += "<hr>";
        break;
      default:
        break;
    }
  }
  if (inUl) html += "</ul>";
  if (inOl) html += "</ol>";
  return html || null;
}

// ─── GET /api/actualites ────────────────────────────────────────────────────────
async function buildActualites(env) {
  const pages = await queryDB(
    env.NOTION_ACTUALITES_DB_ID,
    env,
    { property: "Statut", select: { equals: "Publie" } },
    [{ property: "Date publication", direction: "descending" }],
  );

  const actualites = [];
  for (const page of pages) {
    const p = page.properties;
    const slug = getText(p["Slug"]?.rich_text);
    const iso = p["Date publication"]?.date?.start || "";

    const getFile = (prop) => {
      const f = p[prop]?.files?.[0];
      return f ? f.file?.url || f.external?.url || "" : "";
    };

    const allBlocks = await fetchBlocks(page.id, env);
    const contentBlocks = allBlocks.filter((b) => b.type !== "child_page");
    const subpages = Object.fromEntries(
      allBlocks
        .filter((b) => b.type === "child_page")
        .map((b) => [b.child_page.title.trim(), b.id]),
    );

    const contenu_fr = convertBlocksToHTML(contentBlocks);
    const contenu_en = subpages["Content EN"]
      ? convertBlocksToHTML(await fetchBlocks(subpages["Content EN"], env))
      : null;

    actualites.push({
      id: slug,
      slug,
      categorie: CAT_MAP[p["Categorie"]?.select?.name] || "event",
      date: iso,
      date_fr: formatDate(iso, "fr"),
      date_en: formatDate(iso, "en"),
      auteur: getText(p["Auteur"]?.rich_text) || "Fondation Lefoulon-Delalande",
      tags: (p["Tags"]?.multi_select || []).map((t) => t.name),
      titre_fr: getText(p["Titre"]?.title),
      titre_en: getText(p["Titre EN"]?.rich_text) || getText(p["Titre"]?.title),
      resume_fr: getText(p["Resume FR"]?.rich_text),
      resume_en: getText(p["Resume EN"]?.rich_text),
      contenu_fr,
      contenu_en,
      image: getFile("Image vignette"),
      image_full: getFile("Image hero"),
      url: p["URL officielle"]?.url || "",
      featured: p["En vedette"]?.checkbox || false,
    });
  }
  return { actualites };
}

// ─── GET /api/suggestions ───────────────────────────────────────────────────────
async function buildSuggestions(env) {
  const pages = await queryDB(env.NOTION_SUGGESTIONS_DB_ID, env, {
    property: "Statut",
    select: { equals: "Actif" },
  });

  pages.sort(
    (a, b) =>
      (a.properties["Ordre"]?.number ?? 99) - (b.properties["Ordre"]?.number ?? 99),
  );

  const suggestions = pages.map((page) => {
    const p = page.properties;
    const titreRaw = getText(p["Titre FR"]?.title);
    return {
      id: titreRaw
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 40),
      titre_fr: titreRaw,
      titre_en: getText(p["Titre EN"]?.rich_text) || titreRaw,
      desc_fr: getText(p["Description FR"]?.rich_text),
      desc_en: getText(p["Description EN"]?.rich_text),
      icon: p["Icone"]?.select?.name || "default",
      lien: p["Lien URL"]?.url || "#",
      lien_label_fr: getText(p["Label FR"]?.rich_text) || "En savoir plus",
      lien_label_en: getText(p["Label EN"]?.rich_text) || "Learn more",
    };
  });

  return { suggestions };
}

// ─── Cache KV + réponse ─────────────────────────────────────────────────────────
async function serveCached(env, cors, cacheKey, builder) {
  if (env.KV) {
    const cached = await env.KV.get(cacheKey, "json");
    if (cached) return json(cached, 200, { ...cors, "X-Cache": "HIT" });
  }
  try {
    const data = await builder(env);
    if (env.KV) {
      await env.KV.put(cacheKey, JSON.stringify(data), { expirationTtl: CACHE_TTL });
    }
    return json(data, 200, { ...cors, "X-Cache": "MISS" });
  } catch (err) {
    console.error(`${cacheKey} error:`, err.message);
    return json({ error: "Données indisponibles." }, 502, cors);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(env, request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/api/health") {
      return json({ status: "ok" }, 200, cors);
    }

    if (url.pathname === "/api/actualites" && request.method === "GET") {
      return serveCached(env, cors, "actualites:data", buildActualites);
    }

    if (url.pathname === "/api/suggestions" && request.method === "GET") {
      return serveCached(env, cors, "suggestions:data", buildSuggestions);
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};
