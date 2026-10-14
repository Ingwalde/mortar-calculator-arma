// Сторінка завантаження: показує файли найновішого релізу (ПК-інсталятор, portable, Android APK).
const REPO = "Ingwalde/mortar-calculator-arma";
const RELEASES = `https://github.com/${REPO}/releases`;
const $ = (id) => document.getElementById(id);

const KINDS = [
  { key: "apk", re: /\.apk$/i, title: "Android — APK", desc: "Автономний застосунок: карти й висоти всередині, працює без інтернету. Дозвольте встановлення з невідомих джерел." },
  { key: "setup", re: /Setup.*\.exe$/i, title: "Windows — інсталятор", desc: "З автооновленням. Якщо SmartScreen попереджає: «Докладніше» → «Все одно виконати» (збірка не підписана)." },
  { key: "portable", re: /portable\.exe$/i, title: "Windows — portable", desc: "Один файл без встановлення." }
];

function fmtSize(bytes) {
  const mb = bytes / 1048576;
  return mb >= 10 ? `${Math.round(mb)} МБ` : `${mb.toFixed(1)} МБ`;
}

function platformFirst() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "apk";
  if (/Windows/i.test(ua)) return "setup";
  return null;
}

async function main() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=15`, { headers: { accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(String(res.status));
  const releases = (await res.json()).filter((r) => !r.draft);
  const found = new Map();
  for (const rel of releases) {
    for (const k of KINDS) {
      if (found.has(k.key)) continue;
      const asset = rel.assets.find((a) => k.re.test(a.name) && !/blockmap$/i.test(a.name));
      if (asset) found.set(k.key, { asset, rel });
    }
  }
  const list = $("list");
  const first = platformFirst();
  const ordered = [...KINDS].sort((a, b) => (a.key === first ? -1 : b.key === first ? 1 : 0));
  let count = 0;
  for (const k of ordered) {
    const hit = found.get(k.key);
    if (!hit) continue;
    count++;
    const a = document.createElement("a");
    a.className = "card" + (k.key === first ? " rec" : "");
    a.href = hit.asset.browser_download_url;
    a.rel = "noopener";
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = `${k.title} · ${fmtSize(hit.asset.size)}`;
    const d = document.createElement("div");
    d.className = "d";
    d.textContent = `${k.desc} (${hit.rel.name || hit.rel.tag_name})`;
    a.append(t, d);
    list.appendChild(a);
  }
  const newest = releases.find((r) => !r.prerelease) || releases[0];
  $("ver").textContent = !count ? "Файлів для завантаження поки немає." : newest ? `Остання версія: ${newest.tag_name}` : "";
  const all = document.createElement("a");
  all.href = RELEASES;
  all.textContent = "Усі версії на GitHub";
  all.style.color = "#5fd9a0";
  $("note").append(all);
}

main().catch(() => {
  $("ver").textContent = "";
  const note = $("note");
  note.className = "note err";
  note.textContent = "Не вдалося отримати список версій. Завантажити можна на ";
  const a = document.createElement("a");
  a.href = RELEASES;
  a.textContent = "сторінці релізів GitHub";
  a.style.color = "#5fd9a0";
  note.append(a, ".");
});
