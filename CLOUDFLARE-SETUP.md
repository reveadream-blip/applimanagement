# Mise en place Cloudflare (validation + publication auto)

## Approche recommandee : un seul projet Cloudflare Pages (sans wrangler deploy)

L’API est dans `functions/api/[[path]].js` (Pages Functions). Tu **ne mets pas** `npx wrangler deploy` dans le build.

1. **Un projet Pages** lie a GitHub `applimanagement`.
2. **Build command :** vide  
3. **Build output directory :** `.`  
4. **Deploy command :**  
   - Ideal : vide si ton type de projet ne l’exige pas.  
   - Si le tableau de bord **oblige** une commande et tu utilises Wrangler pour Pages : **`npx wrangler pages deploy .`** (avec un **point** à la fin).  
   - **Ne mets pas** `npx wrangler deploy` : ce n’est pas pour un projet Pages (`wrangler.toml` avec `pages_build_output_dir`) → erreur *Missing entry-point* ou avertissement *wrangler pages deploy should be used*.

Puis : **Parametres du projet Pages → Functions** :
- Lier le namespace KV avec le nom de variable **`APPS_KV`** (meme nom que dans le code).
- Ajouter le secret **`ADMIN_TOKEN`** (mot de passe admin pour `admin-moderation.html`).

Enfin : remplace dans `wrangler.toml` l’id KV (utilise pour coherences / `wrangler pages dev` local) ou configure surtout la liaison dans le dashboard Pages.

---

## Ancienne option Workers (wrangler deploy) — optionnel

Le fichier `cloudflare-app-listing-worker.js` est conserve comme copie ; la logique active est dans **`functions/api/[[path]].js`**.

---

## 1) Creer un KV
- Dashboard Cloudflare -> **Stockage** (ou **Workers & Pages**) -> **KV** -> **Create a namespace**
- Nom conseille: `APPS_KV`
- **Copie le "Namespace ID"** (32 caracteres hex, ex. `a1b2c3d4e5f6...`) : c’est **obligatoire** pour `wrangler.toml`

### Erreur deploy [code: 10042] "KV namespace is not valid"
- Si tu utilises encore **Workers + `wrangler deploy`** : l’`id` dans `wrangler.toml` doit etre le vrai Namespace ID.
- Avec **Pages + Functions** uniquement : configure surtout la liaison **KV → `APPS_KV`** dans **Pages → Settings → Functions** ; tu peux aussi mettre le bon `id` dans `wrangler.toml` pour le dev local.

## 2) Liaisons sur le projet Pages (API + site)

- **KV** : meme namespace que ci-dessus ; nom de variable **`APPS_KV`**.
- **Secret** : **`ADMIN_TOKEN`** (mot de passe long, pour la moderation).
- Les URLs `/api/*` sont servies par **`functions/api/[[path]].js`** sur le **meme domaine** que le site (pas besoin d’un Worker separe si tu n’utilises pas wrangler deploy).

## 3) Utilisation quotidienne
- Les createurs soumettent via:
  - `soumettre-application.html` (FR)
  - `submit-app.html` (EN)
- Les soumissions vont en statut `pending`.
- Tu ouvres `admin-moderation.html`, tu mets ton `ADMIN_TOKEN`, puis:
  - "Valider et publier"
- Une app validee apparait automatiquement sur:
  - `plateforme-referencement.html`

## 4) Securite
- Ne partage jamais `admin-moderation.html` publiquement avec le token.
- Le token admin est requis pour lister/valider.

---

## Si tu gardais un projet Workers separe (non recommande ici)

- Deploy command **`npx wrangler deploy`** = uniquement pour ce projet Workers.
- Pour ce depot, prefere **un seul projet Pages** : site + `functions/` , **sans** wrangler dans le pipeline.
