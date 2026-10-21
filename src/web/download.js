// Сторінка завантаження: підставляє файли найновіших релізів (ПК-інсталятор, portable, Android APK)
// і підсвічує головну кнопку під платформу відвідувача. Без JS і без API лишаються посилання на сторінку релізів.
const REPO = "Ingwalde/mortar-tablet";
const RELEASES = `https://github.com/${REPO}/releases`;
const $ = (id) => document.getElementById(id);

// Мова: українська, якщо в мовах браузера українська раніше за англійську (або обрана кнопкою), інакше англійська.
const LS_LANG = "mortar.dl.lang";
function pickLang() {
  try {
    const saved = localStorage.getItem(LS_LANG);
    if (saved === "uk" || saved === "en") return saved;
  } catch {
    // сховище недоступне — беремо мову браузера
  }
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
  for (const l of list) {
    const c = String(l).toLowerCase();
    if (c.startsWith("uk")) return "uk";
    if (c.startsWith("en")) return "en";
  }
  return "en";
}
const LANG = pickLang();
const S = (uk, en) => (LANG === "en" ? en : uk);

// Англійські тексти; ключ — український вміст елемента (як у download.html).
const EN = {
  "Планшет мінометника": "Mortar Tablet",
  "Балістичний калькулятор для мінометників Arma Reforger: карта, мітки, азимут і підвищення за секунди. На ПК, Android та iPhone.": "Ballistic calculator for Arma Reforger mortar crews: map, markers, azimuth and elevation in seconds. On PC, Android and iPhone.",
  "Завантажити": "Download",
  "Відкрити в браузері": "Open in browser",
  "Завантаження списку версій…": "Loading the list of versions…",
  "Відкрити вебверсію": "Open the web version",
  "Інсталятори поки що недоступні. Користуйтеся вебверсією: вона працює в браузері й встановлюється як застосунок.": "Installers are not available yet. Use the web version: it runs in the browser and can be installed as an app.",
  "Карта, кільця дальності й розрахунок": "Map, range rings and calculation",
  "Той самий планшет на телефоні": "The same tablet on a phone",
  "Безкоштовно, без реклами.": "Free, no ads.",
  "Повна версія: власні карти, обмін мітками з телефоном по Wi-Fi. Інсталятор оновлюється сам.": "Full version: your own maps, sharing markers with a phone over Wi-Fi. The installer updates itself.",
  "Інсталятор": "Installer",
  "Portable (без встановлення)": "Portable (no installation)",
  "Повна версія для Mac: власні карти, обмін мітками з телефоном по Wi-Fi. Файл не підписаний.": "Full version for Mac: your own maps, sharing markers with a phone over Wi-Fi. The file is not signed.",
  "Apple Silicon (M1 і новіші)": "Apple Silicon (M1 and newer)",
  "Повна версія для Linux (x64): AppImage запускається без встановлення, .deb ставиться в Debian і Ubuntu.": "Full version for Linux (x64): AppImage runs without installation, .deb installs on Debian and Ubuntu.",
  "Окремий застосунок: карти вже всередині, працює без інтернету й без ПК.": "Standalone app: the maps are included, works without internet and without a PC.",
  "iPhone та браузер": "iPhone and browser",
  "Нічого не ставити: відкрийте й додайте на головний екран. Карту можна зберегти для роботи без інтернету.": "Nothing to install: open it and add it to the home screen. You can save the map to work without internet.",
  "Відкрити застосунок": "Open the app",
  "Як встановити": "How to install",
  "Коротко для кожної платформи.": "Briefly, for each platform.",
  "Завантажте <b>інсталятор</b> (або portable, якщо встановлення не потрібне) і запустіть.": "Download the <b>installer</b> (or the portable version if you don’t want to install) and run it.",
  "Якщо Windows показує попередження, натисніть <b>«Докладніше» → «Все одно виконати»</b>.": "If Windows shows a warning, click <b>“More info” → “Run anyway”</b>.",
  "Далі застосунок оновлюється сам.": "After that the app updates itself.",
  "Завантажте файл під свій Mac і відкрийте його, перетягніть застосунок у «Програми».": "Download the file for your Mac, open it and drag the app into Applications.",
  "Файл не підписаний, тому macOS попередить про невідомого розробника: у «Програмах» натисніть на застосунок <b>правою кнопкою → «Відкрити»</b> і підтвердьте.": "The file is not signed, so macOS warns about an unknown developer: in Applications <b>right-click the app → “Open”</b> and confirm.",
  "Нова версія: завантажте її з цієї сторінки й замініть застосунок (він сам підкаже, що вийшла нова).": "New version: download it from this page and replace the app (the app tells you when a new one is out).",
  "<b>AppImage:</b> зробіть файл виконуваним (<code>chmod +x</code> або у властивостях файлу) і запустіть.": "<b>AppImage:</b> make the file executable (<code>chmod +x</code> or in the file properties) and run it.",
  "AppImage оновлюється сам. Для .deb завантажте нову версію з цієї сторінки (застосунок підкаже, що вона вийшла).": "AppImage updates itself. For .deb, download the new version from this page (the app tells you when it is out).",
  "Завантажте <b>APK</b> і відкрийте його.": "Download the <b>APK</b> and open it.",
  "Якщо телефон просить, дозвольте встановлення з цього джерела (браузер або «Файли»).": "If the phone asks, allow installation from this source (the browser or “Files”).",
  "Якщо з’явиться попередження, оберіть <b>«Все одно встановити»</b>.": "If a warning appears, choose <b>“Install anyway”</b>.",
  "Щоб оновитись, завантажте нову версію з цієї сторінки й встановіть поверх.": "To update, download the new version from this page and install it over the old one.",
  "iPhone та iPad": "iPhone and iPad",
  "Відкрийте цю сторінку в <b>Safari</b> і натисніть <b>«Відкрити застосунок»</b>.": "Open this page in <b>Safari</b> and tap <b>“Open the app”</b>.",
  "<b>«Поділитись» → «На екран Додому»</b>: з’явиться значок, застосунок запускатиметься на весь екран.": "<b>“Share” → “Add to Home Screen”</b>: an icon appears and the app launches full screen.",
  "Щоб працювало без інтернету, натисніть значок хмарки вгорі й оберіть <b>«Зберегти карту»</b>.": "To work without internet, tap the cloud icon at the top and choose <b>“Save map”</b>.",
  "Що вміє": "Features",
  "Тільки те, що потрібно для розрахунку, без зайвого.": "Only what you need for the calculation, nothing extra.",
  "Дві гармати": "Two mortars",
  "M252 (США, 81 мм) та 2Б14 «Піднос» (82 мм), усі снаряди й заряди.": "M252 (USA, 81 mm) and 2B14 “Podnos” (82 mm), all shells and charges.",
  "Поправка на висоту": "Height correction",
  "Враховує різницю висот між мінометом і ціллю.": "Accounts for the height difference between the mortar and the target.",
  "Карти Reforger": "Reforger maps",
  "Everon, Arland, Kolguyev та модові карти; сітка й підписи пунктів.": "Everon, Arland, Kolguyev and mod maps; grid and place names.",
  "Мітки та місії": "Markers and missions",
  "Міномети, цілі, точки в папках; журнал розрахунків; імпорт та експорт файлом.": "Mortars, targets and points in folders; a calculation log; import and export as a file.",
  "Кільця дальності": "Range rings",
  "Видно, що в зоні досяжності; постріл з анімацією та звуком.": "See what is within reach; a shot with animation and sound.",
  "Без мережі": "Offline",
  "Працює без інтернету. ПК і телефон діляться мітками по Wi-Fi.": "Works without internet. A PC and a phone share markers over Wi-Fi.",
  "Некомерційний проєкт, не пов’язаний із Bohemia Interactive.": "A non-commercial project, not affiliated with Bohemia Interactive.",
  "Ліцензії та подяки": "Licenses and credits",
};

const EN_ATTRS = {
  "Планшет мінометника на ПК: карта Everon з мінометом, цілями й кільцем дальності, праворуч розрахунок": "Mortar Tablet on PC: the Everon map with a mortar, targets and a range ring, the calculation on the right",
  "Планшет мінометника на телефоні": "Mortar Tablet on a phone"
};

function norm(s) {
  return s.replace(/\s+/g, " ").trim();
}

function applyLanguage() {
  document.documentElement.lang = LANG;
  if (LANG === "en") {
    document.title = "Mortar Tablet — download";
    const d = document.querySelector('meta[name="description"]');
    if (d) d.content = "Mortar Tablet — a ballistic calculator for Arma Reforger: map, markers, azimuth and elevation. Windows, macOS, Linux, Android, iPhone.";
    for (const img of document.querySelectorAll("img[alt]")) {
      if (EN_ATTRS[img.alt]) img.alt = EN_ATTRS[img.alt];
    }
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (el.closest("script,style,svg") || (el.parentElement && el.parentElement.closest("[data-i18n-done]"))) continue;
      const html = norm(el.innerHTML);
      if (EN[html] !== undefined) {
        el.innerHTML = EN[html];
        el.setAttribute("data-i18n-done", "1");
        continue;
      }
      // заголовок із піктограмою: міняємо лише текстовий вузол
      const text = norm(el.textContent || "");
      if (EN[text] !== undefined && el.children.length === 1 && el.querySelector("svg")) {
        const node = Array.from(el.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim());
        if (node) node.textContent = " " + EN[text];
      }
    }
  }
  // перемикач мови
  const wrap = document.querySelector("header .wrap");
  if (wrap) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = LANG === "en" ? "Українська" : "English";
    b.style.cssText = "position:absolute;top:0;right:0;background:none;border:1px solid var(--line, #37433b);border-radius:999px;color:inherit;font:inherit;font-size:13px;padding:5px 12px;cursor:pointer";
    b.onclick = () => {
      try {
        localStorage.setItem(LS_LANG, LANG === "en" ? "uk" : "en");
      } catch {
        // без збереження вибір діє до перезавантаження
      }
      location.reload();
    };
    wrap.style.position = "relative";
    wrap.appendChild(b);
  }
}

const KINDS = {
  setup: { re: /Setup.*\.exe$/i, link: "dlSetup", label: S("Завантажити для Windows", "Download for Windows") },
  portable: { re: /portable\.exe$/i, link: "dlPortable", label: S("Завантажити portable", "Download portable") },
  apk: { re: /\.apk$/i, link: "dlApk", label: S("Завантажити для Android", "Download for Android") },
  macArm: { re: /mac-arm64\.dmg$/i, link: "dlMacArm", label: S("Завантажити для Mac", "Download for Mac") },
  macX64: { re: /mac-x64\.dmg$/i, link: "dlMacX64", label: S("Завантажити для Mac", "Download for Mac") },
  appImage: { re: /\.AppImage$/i, link: "dlAppImage", label: S("Завантажити для Linux", "Download for Linux") },
  deb: { re: /\.deb$/i, link: "dlDeb", label: "Завантажити для Linux" }
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
  const unit = S("МБ", "MB");
  return mb >= 10 ? `${Math.round(mb)} ${unit}` : `${mb.toFixed(1)} ${unit}`;
}

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Linux|X11/i.test(ua)) return "linux";
  return "other";
}

function openHow(platform) {
  const id = { android: "howAndroid", ios: "howIos", windows: "howWin", mac: "howMac", linux: "howLinux" }[platform];
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
    text.textContent = S("Відкрити для iPhone", "Open for iPhone");
    return;
  }
  if (!found.setup && !found.apk && !found.portable) {
    // інсталяторів поки нема: головна кнопка відкриває вебверсію
    btn.href = "./";
    text.textContent = S("Відкрити вебверсію", "Open the web version");
    return;
  }
  // macOS/Linux: головна кнопка веде до списку нижче
  btn.href = "#get";
  text.textContent = S("Обрати платформу", "Choose a platform");
}

function setMeta(found) {
  // версія — за ПК-інсталятором (стабільний реліз); тестова Android-збірка з пре-релізу лише позначається
  const newest = (found.setup ?? found.apk)?.rel;
  if (!newest) {
    $("meta").textContent = S("Інсталятори поки що недоступні. Користуйтеся вебверсією: вона працює в браузері й встановлюється як застосунок.", "Installers are not available yet. Use the web version: it runs in the browser and can be installed as an app.");
    return;
  }
  const date = new Date(newest.published_at).toLocaleDateString(S("uk-UA", "en-GB"), { year: "numeric", month: "long", day: "numeric" });
  const parts = [`${S("Версія", "Version")} ${newest.tag_name.replace(/^v/, "")} · ${date}`];
  if (found.apk?.rel.prerelease) parts.push(S("Android-збірка тестова", "Android build is a test build"));
  $("meta").textContent = parts.join(" · ");
}

applyLanguage();
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
    err.textContent = S("Не вдалося отримати список версій. Спробуйте оновити сторінку пізніше.", "Could not load the list of versions. Try refreshing the page later.");
    $("primary").href = RELEASES;
  });
