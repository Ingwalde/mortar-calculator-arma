// Сторінка завантаження: підставляє файли найновіших релізів (ПК-інсталятор, portable, Android APK)
// і підсвічує головну кнопку під платформу відвідувача. Без JS і без API лишаються посилання на сторінку релізів.
const REPO = "Ingwalde/mortar-calculator-arma";
const RELEASES = `https://github.com/${REPO}/releases`;
const $ = (id) => document.getElementById(id);

const KINDS = {
  setup: { re: /Setup.*\.exe$/i, link: "dlSetup", label: "Завантажити для Windows" },
  portable: { re: /portable\.exe$/i, link: "dlPortable", label: "Завантажити portable" },
  apk: { re: /\.apk$/i, link: "dlApk", label: "Завантажити для Android" }
};

/** Лише https на github.com у межах нашого репозиторію: відповідь API — зовнішні дані. */
function trusted(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname === "github.com" && u.pathname.startsWith(`/${REPO}/`);
  } catch {
    return false;
  }
}

function fmtSize(bytes) {
  const mb = bytes / 1048576;
  return mb >= 10 ? `${Math.round(mb)} МБ` : `${mb.toFixed(1)} МБ`;
}

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Windows/i.test(ua)) return "windows";
  return "other";
}

function openHow(platform) {
  const id = { android: "howAndroid", ios: "howIos", windows: "howWin" }[platform];
  const el = id && $(id);
  if (el) el.open = true;
}

function markRecommended(platform) {
  const card = document.querySelector(`[data-card="${platform === "ios" ? "web" : platform}"]`);
  if (card) card.classList.add("rec");
}

async function loadReleases() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=15`, {
    headers: { accept: "application/vnd.github+json" }
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()).filter((r) => !r.draft);
}

function pickAssets(releases) {
  const found = {};
  for (const rel of releases) {
    for (const [key, k] of Object.entries(KINDS)) {
      if (found[key]) continue;
      const asset = rel.assets.find((a) => k.re.test(a.name) && !/blockmap$/i.test(a.name) && trusted(a.browser_download_url));
      if (asset) found[key] = { asset, rel };
    }
  }
  return found;
}

function fill(found) {
  for (const [key, k] of Object.entries(KINDS)) {
    const hit = found[key];
    const a = $(k.link);
    if (!a || !hit) continue;
    a.href = hit.asset.browser_download_url;
    a.classList.remove("off");
    a.rel = "noopener";
    a.querySelector("small").textContent = fmtSize(hit.asset.size);
  }
}

function setPrimary(platform, found) {
  const btn = $("primary");
  const text = $("primaryText");
  const key = platform === "android" ? "apk" : platform === "windows" ? "setup" : null;
  if (key && found[key]) {
    btn.href = found[key].asset.browser_download_url;
    text.textContent = KINDS[key].label;
    $("primarySize").textContent = `· ${fmtSize(found[key].asset.size)}`;
    return;
  }
  if (platform === "ios") {
    btn.href = "./";
    text.textContent = "Відкрити для iPhone";
    return;
  }
  // macOS/Linux або файлів нема: головна кнопка веде до списку нижче
  btn.href = "#get";
  text.textContent = "Обрати платформу";
}

function setMeta(found) {
  // версія — за ПК-інсталятором (стабільний реліз); тестова Android-збірка з пре-релізу лише позначається
  const newest = (found.setup ?? found.apk)?.rel;
  if (!newest) {
    $("meta").textContent = "Файлів для завантаження поки немає.";
    return;
  }
  const date = new Date(newest.published_at).toLocaleDateString("uk-UA", { year: "numeric", month: "long", day: "numeric" });
  const parts = [`Версія ${newest.tag_name.replace(/^v/, "")} · ${date}`];
  if (found.apk?.rel.prerelease) parts.push("Android-збірка тестова");
  $("meta").textContent = parts.join(" · ");
}

const platform = detectPlatform();
openHow(platform);
markRecommended(platform);

loadReleases()
  .then((releases) => {
    const found = pickAssets(releases);
    fill(found);
    setPrimary(platform, found);
    setMeta(found);
  })
  .catch(() => {
    $("meta").textContent = "";
    const err = $("err");
    err.hidden = false;
    err.textContent = "Не вдалося отримати список версій. Спробуйте оновити сторінку пізніше.";
    $("primary").href = RELEASES;
  });
