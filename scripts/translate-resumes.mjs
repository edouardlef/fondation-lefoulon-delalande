/**
 * translate-resumes.mjs
 * Traduit les résumés (et titres) FR → EN via MyMemory (gratuit)
 * et met à jour directement les propriétés Notion.
 *
 * Usage: node scripts/translate-resumes.mjs
 * Option Anthropic: ajouter ANTHROPIC_API_KEY dans .env pour une meilleure qualité.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');

// ── Env ─────────────────────────────────────────────────────────
if (existsSync(resolve(root, '.env'))) {
  const lines = readFileSync(resolve(root, '.env'), 'utf8').split('\n');
  for (const l of lines) {
    const [k, ...v] = l.trim().split('=');
    if (k && !k.startsWith('#')) process.env[k] = v.join('=');
  }
}

const TOKEN   = process.env.NOTION_TOKEN;
const ACT_DB  = process.env.NOTION_ACTUALITES_DB_ID;
const ANT_KEY = process.env.ANTHROPIC_API_KEY || null;

if (!TOKEN || !ACT_DB) {
  console.error('❌ Missing NOTION_TOKEN or NOTION_ACTUALITES_DB_ID in .env');
  process.exit(1);
}

// ── Notion helpers ───────────────────────────────────────────────
const NOTION_H = {
  Authorization:    `Bearer ${TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type':   'application/json',
};

const getText = (arr = []) => (arr || []).map(r => r.plain_text).join('');

async function notionPost(path, body) {
  const r = await fetch(`https://api.notion.com/v1${path}`, {
    method: 'POST', headers: NOTION_H, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}`);
  return r.json();
}

async function notionPatch(pageId, properties) {
  const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH', headers: NOTION_H, body: JSON.stringify({ properties }),
  });
  if (!r.ok) throw new Error(`PATCH pages/${pageId} → ${r.status} ${await r.text()}`);
  return r.json();
}

// ── Traducteur MyMemory (gratuit, pas de clé) ────────────────────
const EMAIL = process.env.MYMEMORY_EMAIL || 'ed200256360@gmail.com';

async function myMemory(text, from, to) {
  if (!text?.trim()) return '';
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}&de=${EMAIL}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`MyMemory ${from}→${to}: ${r.status}`);
  const d = await r.json();
  if (d.responseStatus !== 200) throw new Error(`MyMemory: ${d.responseDetails}`);
  return d.responseData.translatedText;
}

// ── Traducteur Anthropic (optionnel, meilleure qualité) ──────────
async function anthropicTranslate(frText) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         ANT_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role:    'user',
        content: `Translate this French text into English.
Return ONLY a raw JSON object (no markdown) with the key "en".

French: ${frText}`,
      }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic: ${r.status}`);
  const d = await r.json();
  return JSON.parse(d.content[0].text.trim());
}

// ── Traduction d'un texte vers EN ────────────────────────────────
async function translateAll(frText) {
  if (ANT_KEY) {
    return anthropicTranslate(frText);
  }
  const en = await myMemory(frText, 'fr', 'en');
  return { en };
}

// ── Chargement des pages Notion ──────────────────────────────────
console.log(`→ Chargement des articles Notion…`);
console.log(`  Moteur : ${ANT_KEY ? 'Claude Haiku (Anthropic)' : 'MyMemory (gratuit)'}\n`);

const pages = [];
let cursor;
do {
  const body = {
    page_size: 100,
    filter: { property: 'Statut', select: { equals: 'Publie' } },
  };
  if (cursor) body.start_cursor = cursor;
  const data = await notionPost(`/databases/${ACT_DB}/query`, body);
  pages.push(...data.results);
  cursor = data.has_more ? data.next_cursor : null;
} while (cursor);

console.log(`  ${pages.length} articles trouvés\n`);

// ── Traitement article par article ───────────────────────────────
let updated = 0, skipped = 0, errors = 0;

for (const page of pages) {
  const p    = page.properties;
  const slug = getText(p['Slug']?.rich_text) || page.id;

  const titre_fr  = getText(p['Titre']?.title);
  const titre_en  = getText(p['Titre EN']?.rich_text);
  const resume_fr = getText(p['Resume FR']?.rich_text);
  const resume_en = getText(p['Resume EN']?.rich_text);

  const needsTitle  = titre_fr  && !titre_en;
  const needsResume = resume_fr && !resume_en;

  if (!needsTitle && !needsResume) {
    console.log(`  ⏭  ${slug.slice(0, 52)}`);
    skipped++;
    continue;
  }

  process.stdout.write(`  ⟳  ${slug.slice(0, 52)}… `);

  try {
    const properties = {};

    if (needsResume) {
      const t = await translateAll(resume_fr);
      if (t.en) properties['Resume EN'] = { rich_text: [{ text: { content: t.en } }] };
    }

    if (needsTitle) {
      const t = await translateAll(titre_fr);
      if (t.en) properties['Titre EN'] = { rich_text: [{ text: { content: t.en } }] };
    }

    if (Object.keys(properties).length > 0) {
      await notionPatch(page.id, properties);
    }

    console.log('✓');
    updated++;
  } catch (e) {
    console.log(`✗ ${e.message}`);
    errors++;
  }
}

console.log(`\n✓ ${updated} traduits  ⏭ ${skipped} ignorés  ✗ ${errors} erreurs`);
if (updated > 0) {
  console.log('\nRelance le sync pour mettre à jour le JSON du site :');
  console.log('  node scripts/notion-sync.mjs');
}
