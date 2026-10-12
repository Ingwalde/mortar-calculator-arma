/*
 * Service worker офлайн-режиму телефона. Працює лише в безпечному контексті (HTTPS або localhost),
 * тому на телефоні потрібне HTTPS-посилання з довірчим сертифікатом (див. панель «Перегляд з телефона»).
 *
 * Що кешується:
 *  - оболонка застосунку (сторінка, скрипти, стилі, іконки) — одразу при встановленні;
 *  - тайли карт і висоти — коли їх уже завантажено (під час перегляду або кнопкою «Зберегти карту офлайн»).
 * Стан (мітки, журнал) цей worker не чіпає: його зберігає сама сторінка (localStorage) і синхронізує з ПК.
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "0";
const SHELL = "mortar-shell-" + VERSION;
const TILES = "mortar-tiles-v1";

async function collectAssets(cache, path, seen, depth) {
  if (seen.has(path) || depth > 4) return;
  seen.add(path);
  let res;
  try {
    res = await fetch(path, { credentials: "same-origin" });
  } catch {
    return;
  }
  if (!res.ok) return;
  const type = res.headers.get("content-type") || "";
  const copy = res.clone();
  await cache.put(path, res);
  if (!/javascript|css/.test(type)) return;
  const text = await copy.text();
  const base = new URL(path, self.location.origin + "/");
  const found = new Set();
  // «./chunk-abc.js», «/assets/x.woff2», url(...) у css
  for (const m of text.matchAll(/["'(]((?:\.{0,2}\/)?[\w@./-]+\.(?:js|css|woff2?|png|svg|jpg|jpeg|ico))["')]/g)) {
    let u;
    try {
      u = new URL(m[1], base);
    } catch {
      continue;
    }
    if (u.origin === self.location.origin && u.pathname.startsWith("/assets/")) found.add(u.pathname);
  }
  await Promise.all([...found].map((p) => collectAssets(cache, p, seen, depth + 1)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      const res = await fetch("/", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error("shell " + res.status);
      const html = await res.clone().text();
      await cache.put("/", res);
      const seen = new Set();
      const paths = new Set();
      for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
        let u;
        try {
          u = new URL(m[1], self.location.origin + "/");
        } catch {
          continue;
        }
        if (u.origin === self.location.origin) paths.add(u.pathname);
      }
      await Promise.all([...paths].map((p) => collectAssets(cache, p, seen, 0)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("mortar-shell-") && key !== SHELL) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function navigate(request) {
  const cache = await caches.open(SHELL);
  try {
    // Коли ПК недосяжний, браузер довго чекає — тримаємо швидкий відступ на кеш.
    const res = await withTimeout(fetch(request), 4000);
    if (res.ok && new URL(request.url).pathname === "/") cache.put("/", res.clone());
    return res;
  } catch {
    const cached = await cache.match("/");
    if (cached) return cached;
    return new Response("Офлайн: застосунок ще не збережено на цьому пристрої.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const key = new URL(request.url).pathname;
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(key, res.clone());
  return res;
}

async function staticAsset(request) {
  const cache = await caches.open(SHELL);
  const key = new URL(request.url).pathname;
  const hit = await cache.match(key);
  if (hit) {
    // Хешовані файли незмінні; решту тихо оновлюємо в фоні.
    if (!key.startsWith("/assets/")) {
      fetch(request)
        .then((res) => (res.ok ? cache.put(key, res) : undefined))
        .catch(() => undefined);
    }
    return hit;
  }
  const res = await fetch(request);
  if (res.ok) cache.put(key, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  // живі запити стану й подій — завжди напряму (їх офлайн-копію веде сторінка)
  if (p === "/api/events" || p === "/api/store" || p.startsWith("/ca/") || p === "/sw.js") return;
  if (req.mode === "navigate") {
    event.respondWith(navigate(req));
    return;
  }
  if (p.startsWith("/localtile/") || p.startsWith("/tile/") || p.startsWith("/api/heights/")) {
    event.respondWith(cacheFirst(req, TILES));
    return;
  }
  event.respondWith(staticAsset(req));
});
