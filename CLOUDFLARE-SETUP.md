# Mise en place Cloudflare (validation + publication auto)

## 1) Creer un KV
- Dashboard Cloudflare -> Workers & Pages -> KV -> Create namespace
- Nom conseille: `APPS_KV`

## 2) Creer le Worker
- Create Worker (ou `wrangler init`)
- Copier le fichier `cloudflare-app-listing-worker.js` comme code du Worker

## 3) Ajouter les variables
- Binding KV:
  - Variable name: `APPS_KV`
  - Namespace: celui cree plus haut
- Secret:
  - `ADMIN_TOKEN` = mot de passe long et prive

## 4) Ajouter la route
- Route du Worker: `applimanagement.com/api/*`

## 5) Publier le Worker
- Deploy

## 6) Utilisation quotidienne
- Les createurs soumettent via:
  - `soumettre-application.html` (FR)
  - `submit-app.html` (EN)
- Les soumissions vont en statut `pending`.
- Tu ouvres `admin-moderation.html`, tu mets ton `ADMIN_TOKEN`, puis:
  - "Valider et publier"
- Une app validee apparait automatiquement sur:
  - `plateforme-referencement.html`

## 7) Securite
- Ne partage jamais `admin-moderation.html` publiquement avec le token.
- Le token admin est requis pour lister/valider.

---

## Deploiement Git (Workers + Pages) — reglages a corriger

### Deux produits distincts
- **Cloudflare Pages** = heberge le site (HTML, images, `index.html`, etc.). Pas de `npm run dev` ici.
- **Workers** = heberge uniquement l’API (`/api/...`). Fichiers: `cloudflare-app-listing-worker.js` + `wrangler.toml`.

### Dans ton projet Workers (capture d’ecran Git)
Ne pas utiliser **`npm run dev`** comme deploy command : c’est pour ton PC, pas pour la prod.

Pour ce repo (avec `package.json` et `wrangler.toml`) tu peux mettre par exemple :
- **Build command:** `npm install`
- **Deploy command:** `npx wrangler deploy`
- **Root directory:** `/`

Avant le premier deploy :
1. Ouvre `wrangler.toml` et remplace `REMPLACEZ_PAR_VOTRE_KV_NAMESPACE_ID` par l’ID du namespace KV (Workers & Pages → KV).
2. Configure le secret **`ADMIN_TOKEN`** : `wrangler secret put ADMIN_TOKEN` en local apres login, ou Variables → Secrets dans le dashboard du Worker.

### Pages (site statique)
- **Build command:** vide
- **Output directory:** `.`
- Pas de `wrangler deploy` dans Pages (sauf projet hybride specifique).
