# Déploiement — Fondation Lefoulon-Delalande (Cloudflare)

Même architecture que les autres projets : **1 Worker** (données Notion + API) + **1 Pages** (site statique).

```
https://www.fondation-lefoulon-delalande.fr        → Cloudflare Pages   (racine du repo)
https://fondation-worker.<compte>.workers.dev      → Cloudflare Worker  (dossier worker/)
```

Le front est **statique** (HTML/CSS/JS, pas de build). Il lit ses données soit depuis
les JSON statiques (`assets/data/*.json`, défaut), soit depuis le Worker — au choix via
une seule constante `API_BASE` dans `assets/js/include.js`.

---

## Étape 0 — Mettre le projet sur GitHub (prérequis auto-déploiement)

Le dossier n'est pas encore un dépôt git. Depuis `fondation-lefoulon/` :

```bash
git init
git add .
git commit -m "init: site fondation + worker"
# créer un repo vide sur github.com puis :
git remote add origin https://github.com/<toi>/fondation-lefoulon.git
git branch -M main
git push -u origin main
```

> `.gitignore` protège déjà `.env` et `worker/.dev.vars` — tes tokens Notion ne partent pas.
> Vérifie sur GitHub qu'ils **n'apparaissent pas** dans les fichiers poussés.

---

## 1) Le Worker — `worker/`

### a. Créer le Worker (connecté au repo)

Lien : **https://dash.cloudflare.com** → menu **Workers & Pages** → **Create** → onglet **Workers** → **Import a repository** → choisir `fondation-lefoulon`.

Réglages de build :
- **Root directory** : `worker`
- **Deploy command** : `npx wrangler deploy --env production`
- **Build command** : *(laisser vide)*

### b. Créer le namespace KV (cache des données Notion)

Lien : **Workers & Pages → KV** (`https://dash.cloudflare.com` → KV) → **Create namespace** → nom `fondation-kv`.

Puis copier l'`id` retourné dans [worker/wrangler.toml](worker/wrangler.toml), section production
(décommenter le bloc `[[env.production.kv_namespaces]]` et remplacer l'id). Recommit + push.

> Le Worker fonctionne **sans** KV (il interroge Notion à chaque requête) ; le KV ne fait
> qu'ajouter un cache de 1 h. Optionnel mais conseillé en prod.

### c. Variables d'environnement du Worker

Dashboard → **Workers & Pages → `fondation-worker` → Settings → Variables and Secrets**.

| Nom | Type | Valeur | D'où ça vient |
|---|---|---|---|
| `NOTION_TOKEN` | **Secret** | `ntn_…` | ton `.env` / `worker/.dev.vars` |
| `NOTION_ACTUALITES_DB_ID` | **Secret** | `38976f30-…-d3c7` | idem |
| `NOTION_SUGGESTIONS_DB_ID` | **Secret** | `38976f30-…-ce57` | idem |
| `FRONT_URL` | Variable | `https://www.fondation-lefoulon-delalande.fr` | déjà dans `wrangler.toml` (rien à faire) |

> Les 3 `NOTION_*` sont à ajouter en **Secret** (pas en variable en clair).
> Alternative CLI : `cd worker && npx wrangler secret put NOTION_TOKEN --env production` (idem pour les 2 autres).

### d. Déploiement manuel (si tu ne veux pas passer par GitHub)

```bash
cd worker
npm install
npx wrangler login                       # une seule fois
npx wrangler secret put NOTION_TOKEN --env production
npx wrangler secret put NOTION_ACTUALITES_DB_ID --env production
npx wrangler secret put NOTION_SUGGESTIONS_DB_ID --env production
npx wrangler deploy --env production
```

### e. Vérifier

Ouvre `https://fondation-worker.<compte>.workers.dev/api/health` → `{"status":"ok"}`
puis `/api/actualites` → doit renvoyer `{ "actualites": [...] }`.

---

## 2) Le Front — racine du repo

### a. Créer le projet Pages

Lien : **https://dash.cloudflare.com** → **Workers & Pages** → **Create** → onglet **Pages** → **Connect to Git** → choisir `fondation-lefoulon`.

Réglages de build :
- **Root directory** : `/` (racine)
- **Framework preset** : `None`
- **Build command** : *(laisser vide — site statique)*
- **Build output directory** : `/`

### b. Variables d'environnement du Front

**Aucune.** Le site est statique : il n'y a pas de build pour injecter une variable.
L'URL du Worker se règle directement dans le code (étape suivante).

### c. Brancher le Front sur le Worker

Dans [assets/js/include.js](assets/js/include.js), renseigne l'URL de ton Worker :

```js
const API_BASE = 'https://fondation-worker.<compte>.workers.dev';
```

- `''` (défaut) → le site lit les **JSON statiques** (`assets/data/*.json`) générés par le sync GitHub Actions.
- URL du Worker → **tout passe par le Worker** (données Notion en direct).

Recommit + push → Pages se redéploie.

---

## Variables d'environnement — récapitulatif

| Service | À ajouter | Où |
|---|---|---|
| **Worker** | `NOTION_TOKEN`, `NOTION_ACTUALITES_DB_ID`, `NOTION_SUGGESTIONS_DB_ID` (Secrets) | Workers → Settings → Variables and Secrets |
| **Worker** | `FRONT_URL` | déjà dans `wrangler.toml` — rien à faire |
| **Front (Pages)** | *(aucune)* | l'URL du Worker va dans `include.js` → `API_BASE` |

---

## Les deux modes de données (à décider)

| Mode | `API_BASE` | GitHub Actions `sync-notion.yml` | Avantage |
|---|---|---|---|
| **Statique** (défaut) | `''` | actif (regénère les JSON chaque heure, commit) | ultra rapide, cache CDN, marche sans Worker |
| **Full Worker** | URL du Worker | peut être désactivé | données Notion en temps réel |

Conseil : déploie le Worker, teste `/api/actualites`, et ne passe `API_BASE` sur l'URL du Worker
que quand tu es satisfait. Tu peux garder les deux : Worker en direct + JSON statiques en secours.

---

## Dev local

```bash
cd worker
npm install
npx wrangler dev --local        # Worker sur http://localhost:8787
# → tester http://localhost:8787/api/actualites
```

Secrets locaux : `worker/.dev.vars` (déjà rempli, **jamais commité**).
Pour tester le front branché sur le Worker local : mettre `API_BASE = 'http://localhost:8787'`
dans `include.js` et servir le site (ex. `npx serve` à la racine).
