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
