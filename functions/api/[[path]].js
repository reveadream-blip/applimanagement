/**
 * Cloudflare Pages Function — meme API que cloudflare-app-listing-worker.js
 * Deploy : projet Pages uniquement (build vide, sortie ".") — pas de "npx wrangler deploy".
 * Liaisons : Dashboard Pages → Parametres → Functions → lier KV "APPS_KV" + secret ADMIN_TOKEN.
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  try {
    if (request.method === "POST" && path === "/api/submissions") {
      return createSubmission(request, env);
    }

    if (request.method === "GET" && path === "/api/apps") {
      return listApprovedApps(env);
    }

    if (request.method === "GET" && path === "/api/submissions") {
      return listSubmissions(request, env, url);
    }

    const approveMatch = path.match(/^\/api\/submissions\/([^/]+)\/approve$/);
    if (request.method === "POST" && approveMatch) {
      return approveSubmission(request, env, approveMatch[1]);
    }

    const updateMatch = path.match(/^\/api\/submissions\/([^/]+)$/);
    if ((request.method === "PATCH" || request.method === "PUT") && updateMatch) {
      return updateSubmission(request, env, updateMatch[1]);
    }

    const deleteMatch = path.match(/^\/api\/submissions\/([^/]+)$/);
    if (request.method === "DELETE" && deleteMatch) {
      return deleteSubmission(request, env, deleteMatch[1]);
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json(
      {
        error: "Internal server error",
        detail: "Pages Function failed. Check APPS_KV binding and ADMIN_TOKEN secret.",
      },
      500
    );
  }
}

async function createSubmission(request, env) {
  const missingKv = requireKv(env);
  if (missingKv) return missingKv;

  const formData = await request.formData();
  const screenshotFile = formData.get("screenshot_file");
  const screenshotFromFile = await fileToDataUrl(screenshotFile);

  const payload = {
    id: crypto.randomUUID(),
    app_name: clean(formData.get("app_name")),
    creator_name: clean(formData.get("creator_name")),
    category: clean(formData.get("category")),
    platform: clean(formData.get("platform")),
    app_link: clean(formData.get("app_link")),
    description: clean(formData.get("description")),
    email: clean(formData.get("email")),
    screenshot_link: clean(formData.get("screenshot_link")) || screenshotFromFile,
    logo_link: clean(formData.get("logo_link")),
    status: "pending",
    created_at: new Date().toISOString(),
    approved_at: null,
  };

  if (
    !payload.app_name ||
    !payload.creator_name ||
    !payload.category ||
    !payload.platform ||
    !payload.app_link ||
    !payload.screenshot_link ||
    !payload.description ||
    !payload.email
  ) {
    return json({ error: "Missing required fields" }, 400);
  }

  if (!isHttpUrl(payload.app_link)) {
    return json({ error: "Invalid app URL" }, 400);
  }
  if (!isImageSource(payload.screenshot_link)) {
    return json({ error: "Invalid screenshot input (URL or image file required)" }, 400);
  }

  await env.APPS_KV.put(`submission:${payload.id}`, JSON.stringify(payload));
  await pushId(env, "pending_ids", payload.id);
  await sendSubmissionEmailNotification(payload);

  return json({ ok: true, id: payload.id });
}

async function listApprovedApps(env) {
  const missingKv = requireKv(env);
  if (missingKv) return missingKv;

  const ids = await getIds(env, "approved_ids");
  const apps = [];
  for (const id of ids) {
    const raw = await env.APPS_KV.get(`submission:${id}`);
    if (!raw) continue;
    const item = JSON.parse(raw);
    if (item.status === "approved") {
      apps.push(item);
    }
  }

  apps.sort((a, b) => new Date(b.approved_at || 0) - new Date(a.approved_at || 0));
  return json(apps);
}

async function listSubmissions(request, env, url) {
  const missingKv = requireKv(env);
  if (missingKv) return missingKv;

  const missingAdmin = requireAdminSecret(env);
  if (missingAdmin) return missingAdmin;

  if (!isAuthorized(request, env)) {
    return json({ error: "Unauthorized", detail: "Bearer token does not match ADMIN_TOKEN." }, 401);
  }

  const status = url.searchParams.get("status") || "pending";
  const ids = await getIds(env, status === "approved" ? "approved_ids" : "pending_ids");
  const items = [];
  for (const id of ids) {
    const raw = await env.APPS_KV.get(`submission:${id}`);
    if (!raw) continue;
    const item = JSON.parse(raw);
    if (item.status === status) items.push(item);
  }

  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return json(items);
}

async function approveSubmission(request, env, id) {
  const missingKv = requireKv(env);
  if (missingKv) return missingKv;

  const missingAdmin = requireAdminSecret(env);
  if (missingAdmin) return missingAdmin;

  if (!isAuthorized(request, env)) {
    return json({ error: "Unauthorized", detail: "Bearer token does not match ADMIN_TOKEN." }, 401);
  }

  const key = `submission:${id}`;
  const raw = await env.APPS_KV.get(key);
  if (!raw) {
    return json({ error: "Submission not found" }, 404);
  }

  const item = JSON.parse(raw);
  item.status = "approved";
  item.approved_at = new Date().toISOString();

  await env.APPS_KV.put(key, JSON.stringify(item));
  await removeId(env, "pending_ids", id);
  await pushId(env, "approved_ids", id);

  return json({ ok: true });
}

async function updateSubmission(request, env, id) {
  const missingKv = requireKv(env);
  if (missingKv) return missingKv;
  const missingAdmin = requireAdminSecret(env);
  if (missingAdmin) return missingAdmin;
  if (!isAuthorized(request, env)) {
    return json({ error: "Unauthorized", detail: "Bearer token does not match ADMIN_TOKEN." }, 401);
  }

  const key = `submission:${id}`;
  const raw = await env.APPS_KV.get(key);
  if (!raw) return json({ error: "Submission not found" }, 404);
  const item = JSON.parse(raw);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const next = {
    ...item,
    app_name: clean(body.app_name ?? item.app_name),
    creator_name: clean(body.creator_name ?? item.creator_name),
    category: clean(body.category ?? item.category),
    platform: clean(body.platform ?? item.platform),
    app_link: clean(body.app_link ?? item.app_link),
    description: clean(body.description ?? item.description),
    screenshot_link: clean(body.screenshot_link ?? item.screenshot_link),
    email: clean(body.email ?? item.email),
    logo_link: clean(body.logo_link ?? item.logo_link),
  };

  if (
    !next.app_name ||
    !next.creator_name ||
    !next.category ||
    !next.platform ||
    !next.app_link ||
    !next.screenshot_link ||
    !next.description ||
    !next.email
  ) {
    return json({ error: "Missing required fields after update" }, 400);
  }
  if (!isHttpUrl(next.app_link)) return json({ error: "Invalid app URL" }, 400);
  if (!isImageSource(next.screenshot_link)) return json({ error: "Invalid screenshot source" }, 400);

  await env.APPS_KV.put(key, JSON.stringify(next));
  return json({ ok: true, item: next });
}

async function deleteSubmission(request, env, id) {
  const missingKv = requireKv(env);
  if (missingKv) return missingKv;
  const missingAdmin = requireAdminSecret(env);
  if (missingAdmin) return missingAdmin;
  if (!isAuthorized(request, env)) {
    return json({ error: "Unauthorized", detail: "Bearer token does not match ADMIN_TOKEN." }, 401);
  }

  const key = `submission:${id}`;
  const raw = await env.APPS_KV.get(key);
  if (!raw) return json({ error: "Submission not found" }, 404);

  await env.APPS_KV.delete(key);
  await removeId(env, "pending_ids", id);
  await removeId(env, "approved_ids", id);

  return json({ ok: true, id });
}

function clean(value) {
  return String(value || "").trim();
}

function isAuthorized(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const expected = `Bearer ${env.ADMIN_TOKEN}`;
  return auth === expected;
}

function requireKv(env) {
  if (!env || !env.APPS_KV) {
    return json(
      {
        error: "Configuration error",
        detail: "APPS_KV binding missing in Cloudflare Pages Settings > Functions > Bindings.",
      },
      500
    );
  }
  return null;
}

function requireAdminSecret(env) {
  if (!env || env.ADMIN_TOKEN === undefined || env.ADMIN_TOKEN === "") {
    return json(
      {
        error: "Configuration error",
        detail:
          "ADMIN_TOKEN secret missing. Add it in Pages Settings > Variables and Secrets (Production), then redeploy.",
      },
      503
    );
  }
  return null;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isImageSource(value) {
  if (!value) return false;
  if (isHttpUrl(value)) return true;
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

async function fileToDataUrl(fileValue) {
  if (!fileValue || typeof fileValue === "string") return "";
  if (typeof fileValue.arrayBuffer !== "function") return "";
  if (!fileValue.type || !fileValue.type.startsWith("image/")) return "";
  if (fileValue.size > 2 * 1024 * 1024) return "";

  const buffer = await fileValue.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:${fileValue.type};base64,${base64}`;
}

async function getIds(env, key) {
  const raw = await env.APPS_KV.get(key);
  if (!raw) return [];
  try {
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

async function pushId(env, key, id) {
  const ids = await getIds(env, key);
  if (!ids.includes(id)) ids.push(id);
  await env.APPS_KV.put(key, JSON.stringify(ids));
}

async function removeId(env, key, id) {
  const ids = await getIds(env, key);
  const next = ids.filter((x) => x !== id);
  await env.APPS_KV.put(key, JSON.stringify(next));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function sendSubmissionEmailNotification(payload) {
  try {
    const form = new URLSearchParams();
    form.set("_subject", `Nouvelle soumission d'application - ${payload.app_name}`);
    form.set("_template", "table");
    form.set("_captcha", "false");
    form.set("app_name", payload.app_name);
    form.set("creator_name", payload.creator_name);
    form.set("category", payload.category);
    form.set("platform", payload.platform);
    form.set("app_link", payload.app_link);
    form.set("description", payload.description);
    form.set("email", payload.email);
    form.set(
      "screenshot_link",
      payload.screenshot_link && payload.screenshot_link.startsWith("data:image/")
        ? "Image uploadée via formulaire (stockée en base)."
        : payload.screenshot_link || ""
    );
    form.set("logo_link", payload.logo_link || "");
    form.set("submission_id", payload.id);
    form.set("created_at", payload.created_at);

    await fetch("https://formsubmit.co/contact.applimanagement@gmail.com", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
  } catch {
    /* Best effort: ne pas bloquer la soumission si l'email echoue */
  }
}
