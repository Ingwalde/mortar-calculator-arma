import { fmtM, gridRef, parseGrid } from "@core/geometry";
import { PRESETS, findPreset } from "@core/terrains";
import { TABLES, bearing, shellRange, solve, type WeaponId } from "@core/ballistics";
import {
  addCustomTerrain,
  addFireLogEntry,
  ALL_FOLDERS,
  applyExternalState,
  currentMeta,
  getCurrent,
  getFolderNames,
  getRoot,
  getVisibleMarkers,
  markersInFolder,
  removeCustomTerrain,
  scheduleSave,
  switchTerrain,
  uid,
  type Marker,
  type MarkerType
} from "./state";
import {
  centerOnWorld,
  centerPx,
  centerWorld,
  requestDraw,
  resetView,
  setDrawCallbacks,
  setShowPlaces,
  setTapHandlers,
  syncImageSize
} from "./mapView";
import { $, ask, toast } from "./dom";
import { ensureHeights, ensureMapImage, getAutoHeight, startMapImportUi } from "./mapImport";
import { onLangChange, t } from "./i18n";
import { initImmersive, initSheet } from "./sheet";
import { isRemote } from "./platform";
import { initLanPanel, refreshLanPanel, relocalizeLanPanel } from "./lanPanel";

function typeLabel(type: MarkerType): string {
  return { mortar: t("typeMortar"), target: t("typeTarget"), point: t("typePoint") }[type];
}
function weaponName(w: WeaponId): string {
  return { M252: t("weaponShortM252"), "2B14": t("weaponShort2B14") }[w];
}
function shellName(k: string): string {
  return ({ HE: t("shellHE"), Smoke: t("shellSmoke"), Illumination: t("shellIllumination") } as Record<string, string>)[k] ?? k;
}

let selectedId: string | null = null;

function nextName(type: MarkerType): string {
  const n = getCurrent().markers.filter((m) => m.type === type).length + 1;
  return typeLabel(type) + " " + n;
}

// ---------- folders/missions ----------
function fillFolderSelect(): void {
  const sel = $<HTMLSelectElement>("folderSel");
  const S = getCurrent();
  sel.textContent = "";
  sel.add(new Option(t("allFolders"), ALL_FOLDERS));
  for (const f of getFolderNames()) sel.add(new Option(f || t("noFolder"), f));
  if (![...sel.options].some((o) => o.value === S.sel.folder)) S.sel.folder = ALL_FOLDERS;
  sel.value = S.sel.folder;
}
$<HTMLSelectElement>("folderSel").onchange = (e) => {
  getCurrent().sel.folder = (e.target as HTMLSelectElement).value;
  scheduleSave();
  renderAll();
};

/** Останньо використана папка — типове значення для нової мітки. */
function lastUsedFolder(): string {
  const S = getCurrent();
  return S.sel.folder === ALL_FOLDERS ? "" : S.sel.folder;
}

// ---------- marks list ----------
export function renderMarksList(): void {
  fillFolderSelect();
  const ul = $("list");
  ul.textContent = "";
  const S = getCurrent();
  const visible = getVisibleMarkers();
  if (!visible.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = S.markers.length ? t("emptyListFiltered") : t("emptyListNone");
    ul.appendChild(li);
    return;
  }
  for (const m of visible) {
    const li = document.createElement("li");
    li.dataset.id = m.id;
    if (m.id === selectedId) li.className = "sel";
    const badge = document.createElement("div");
    badge.className = "badge b-" + m.type;
    const bs = document.createElement("span");
    bs.textContent = { mortar: t("badgeMortar"), target: t("badgeTarget"), point: t("badgePoint") }[m.type];
    badge.appendChild(bs);
    const info = document.createElement("div");
    info.className = "info";
    info.tabIndex = 0;
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = m.name || typeLabel(m.type);
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent =
      (S.sel.folder === ALL_FOLDERS ? "[" + (m.folder || t("noFolder")) + "]   " : "") +
      (m.type === "mortar" ? weaponName(m.w) + "   " : "") +
      gridRef(m.x, m.z) +
      "   X " + fmtM(m.x) + "  Z " + fmtM(m.z) +
      (m.h !== null && isFinite(m.h) ? "   h " + fmtM(m.h) : "");
    info.append(name, sub);
    info.onclick = () => selectMarker(m.id, true);
    info.onkeydown = (e) => {
      if (e.key === "Enter") selectMarker(m.id, true);
    };
    const copyBtn = document.createElement("button");
    copyBtn.className = "btn small";
    copyBtn.textContent = t("copyBtn");
    copyBtn.onclick = () => copyText(gridRef(m.x, m.z) + " (X " + Math.round(m.x) + ", Z " + Math.round(m.z) + ")");
    const editBtn = document.createElement("button");
    editBtn.className = "btn small";
    editBtn.textContent = t("editBtn");
    editBtn.onclick = () => openMarkerDialog(m);
    li.append(badge, info, copyBtn, editBtn);
    ul.appendChild(li);
  }
}

export function selectMarker(id: string, center: boolean): void {
  selectedId = id;
  setDrawCallbacks({ selectedId });
  const m = getCurrent().markers.find((x) => x.id === id);
  if (m && center) centerOnWorld(m.x, m.z);
  renderMarksList();
  requestDraw();
  document.querySelector(`#list li[data-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(t("copied"));
  } catch {
    if (isRemote) {
      // На телефоні вкладки «Карта» (з полем резервної копії) нема — показуємо текст у діалозі.
      await ask(t("copyManualTitle"), "", t("closeBtn"), [{ key: "v", label: t("copyManualLabel"), value: text }]);
      return;
    }
    const box = $<HTMLTextAreaElement>("json");
    box.value = text;
    showTab("setup");
    box.select();
    toast(t("copyFromField"));
  }
}

// ---------- marker dialog ----------
const dlg = $<HTMLDialogElement>("dlg");
let editing: Marker | null = null;
let dlgType: MarkerType = "target";
let dlgWeapon: WeaponId = "M252";

function setDlgType(t: MarkerType): void {
  dlgType = t;
  for (const b of $("fType").querySelectorAll<HTMLButtonElement>("button")) {
    b.setAttribute("aria-pressed", b.dataset.t === t ? "true" : "false");
  }
  $("fWeapon").hidden = t !== "mortar";
}
function setDlgWeapon(w: WeaponId): void {
  dlgWeapon = w;
  for (const b of $("fWeapon").querySelectorAll<HTMLButtonElement>("button")) {
    b.setAttribute("aria-pressed", b.dataset.w === w ? "true" : "false");
  }
}
$("fWeapon").onclick = (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (b) setDlgWeapon(b.dataset.w as WeaponId);
};
$("fType").onclick = (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!b) return;
  const newType = b.dataset.t as MarkerType;
  setDlgType(newType);
  const nameInput = $<HTMLInputElement>("fName");
  const autoNameRe = new RegExp(`^(${typeLabel("mortar")}|${typeLabel("target")}|${typeLabel("point")}) \\d+$`);
  if (!editing && autoNameRe.test(nameInput.value)) nameInput.value = nextName(newType);
};

interface DialogPreset {
  type: MarkerType;
  x: number;
  z: number;
  h: number | null;
  fromMap?: boolean;
}

function fillFolderDatalist(): void {
  const dl = $("folderList");
  dl.textContent = "";
  for (const f of getFolderNames()) {
    if (!f) continue;
    const opt = document.createElement("option");
    opt.value = f;
    dl.appendChild(opt);
  }
}

export function openMarkerDialog(marker?: Marker, preset?: DialogPreset): void {
  editing = marker ?? null;
  const d: DialogPreset = marker ?? preset!;
  setDlgType(d.type);
  const lastMortar = [...getCurrent().markers].reverse().find((x) => x.type === "mortar");
  setDlgWeapon(marker?.w ?? lastMortar?.w ?? "M252");
  $("dlgTitle").textContent = marker ? t("dlgTitleEdit") : t("dlgTitleNew");
  $<HTMLInputElement>("fName").value = marker ? marker.name : nextName(d.type);
  $<HTMLInputElement>("fX").value = isFinite(d.x) ? String(Math.round(d.x)) : "";
  $<HTMLInputElement>("fZ").value = isFinite(d.z) ? String(Math.round(d.z)) : "";
  $<HTMLInputElement>("fH").value = d.h !== null && isFinite(d.h) ? String(d.h) : "";
  $<HTMLInputElement>("fH").placeholder = t("heightOptional");
  $<HTMLInputElement>("fGrid").value = isFinite(d.x) && isFinite(d.z) && (marker || preset?.fromMap) ? gridRef(d.x, d.z) : "";
  fillFolderDatalist();
  $<HTMLInputElement>("fFolder").value = marker ? marker.folder : lastUsedFolder();
  $<HTMLButtonElement>("fDel").hidden = !marker;
  dlg.showModal();

  if (!marker && d.h === null && isFinite(d.x) && isFinite(d.z)) {
    const requestX = d.x;
    const requestZ = d.z;
    const meta = currentMeta();
    const hInput = $<HTMLInputElement>("fH");
    hInput.placeholder = t("heightDetermining");
    void getAutoHeight(meta.id, requestX, requestZ, meta.sizeX, meta.sizeZ).then((h) => {
      if (dlg.open && !editing && hInput.value === "") {
        if (h !== null) hInput.value = String(h);
        else hInput.placeholder = t("heightUnknown");
      }
    });
  }
}

$("fGrid").addEventListener("input", () => {
  const g = parseGrid($<HTMLInputElement>("fGrid").value);
  if (g) {
    $<HTMLInputElement>("fX").value = String(Math.round(g.x));
    $<HTMLInputElement>("fZ").value = String(Math.round(g.z));
  }
});
$<HTMLButtonElement>("fCancel").onclick = () => dlg.close();
$<HTMLButtonElement>("fDel").onclick = () => {
  if (editing) {
    const S = getCurrent();
    S.markers = S.markers.filter((x) => x.id !== editing!.id);
    if (selectedId === editing.id) selectedId = null;
    scheduleSave();
    renderAll();
    toast(t("markDeleted"));
  }
  dlg.close();
};
$<HTMLFormElement>("dlgForm").addEventListener("submit", (e) => {
  const x = parseFloat($<HTMLInputElement>("fX").value);
  const z = parseFloat($<HTMLInputElement>("fZ").value);
  if (!isFinite(x) || !isFinite(z)) {
    e.preventDefault();
    toast(t("fillXZorGrid"));
    return;
  }
  const hv = $<HTMLInputElement>("fH").value.trim();
  const h = hv === "" ? null : parseFloat(hv);
  const data = {
    name: $<HTMLInputElement>("fName").value.trim().slice(0, 40) || nextName(dlgType),
    type: dlgType,
    x,
    z,
    h: h !== null && isFinite(h) ? h : null,
    w: dlgWeapon,
    folder: $<HTMLInputElement>("fFolder").value.trim().slice(0, 40)
  };
  const S = getCurrent();
  if (editing) Object.assign(editing, data);
  else {
    const m: Marker = { id: uid(), ...data };
    S.markers.push(m);
    selectedId = m.id;
    if (m.type === "mortar") {
      S.sel.m = m.id;
      // Нова мітка має лишитись доступною в розрахунку, навіть якщо вибрана інша папка.
      if (S.sel.mortarFolder !== ALL_FOLDERS && S.sel.mortarFolder !== m.folder) S.sel.mortarFolder = ALL_FOLDERS;
    }
    if (m.type === "target") {
      S.sel.t = m.id;
      if (S.sel.targetFolder !== ALL_FOLDERS && S.sel.targetFolder !== m.folder) S.sel.targetFolder = ALL_FOLDERS;
    }
  }
  scheduleSave();
  renderAll();
  toast(editing ? t("markSaved") : t("markAdded"));
});

$<HTMLButtonElement>("placeBtn").onclick = () => {
  if (calibPick) {
    fixCalibAtCenter(calibPick);
    return;
  }
  const w = centerWorld();
  const hasMortar = getCurrent().markers.some((m) => m.type === "mortar");
  openMarkerDialog(undefined, { type: hasMortar ? "target" : "mortar", x: w.x, z: w.z, h: null, fromMap: true });
};
$<HTMLButtonElement>("addManual").onclick = () => {
  const hasMortar = getCurrent().markers.some((m) => m.type === "mortar");
  openMarkerDialog(undefined, { type: hasMortar ? "target" : "mortar", x: NaN, z: NaN, h: null });
  $<HTMLInputElement>("fX").value = "";
  $<HTMLInputElement>("fZ").value = "";
  setTimeout(() => $<HTMLInputElement>("fGrid").focus(), 50);
};

// ---------- fire solution ----------
interface FirePairPoint {
  x: number;
  z: number;
  h: number | null;
  name: string;
}
function firePair(): { m: Marker; t: FirePairPoint } | null {
  const S = getCurrent();
  const mortars = markersInFolder(S.sel.mortarFolder).filter((x) => x.type === "mortar");
  const m = mortars.find((x) => x.id === S.sel.m) ?? mortars[0];
  if (!m) return null;
  let target: FirePairPoint | null = null;
  if (S.sel.t === "__center") {
    const w = centerWorld();
    target = { x: w.x, z: w.z, h: null, name: t("centerName") };
  } else {
    const found = markersInFolder(S.sel.targetFolder).find((x) => x.id === S.sel.t && x.type !== "mortar");
    if (found) target = found;
  }
  if (!target) return null;
  return { m, t: target };
}
setDrawCallbacks({ firePair });

/** Папки, у яких є хоча б одна мітка потрібного виду, плюс "усі папки". */
function fillFolderOptions(sel: HTMLSelectElement, current: string, wantMortar: boolean): string {
  sel.textContent = "";
  sel.add(new Option(t("allFolders"), ALL_FOLDERS));
  const names = new Set(
    getCurrent()
      .markers.filter((m) => (m.type === "mortar") === wantMortar)
      .map((m) => m.folder)
  );
  for (const f of [...names].sort((a, b) => a.localeCompare(b, "uk"))) sel.add(new Option(f || t("noFolder"), f));
  const value = [...sel.options].some((o) => o.value === current) ? current : ALL_FOLDERS;
  sel.value = value;
  return value;
}

function fillFireSelects(): void {
  const S = getCurrent();
  S.sel.mortarFolder = fillFolderOptions($<HTMLSelectElement>("selMFolder"), S.sel.mortarFolder, true);
  S.sel.targetFolder = fillFolderOptions($<HTMLSelectElement>("selTFolder"), S.sel.targetFolder, false);
  const selM = $<HTMLSelectElement>("selM");
  const selT = $<HTMLSelectElement>("selT");
  selM.textContent = "";
  selT.textContent = "";
  const mortars = markersInFolder(S.sel.mortarFolder).filter((x) => x.type === "mortar");
  if (!mortars.length) {
    selM.add(new Option(t("noMortars"), ""));
    selM.disabled = true;
  } else {
    selM.disabled = false;
    for (const m of mortars) selM.add(new Option(m.name, m.id));
  }
  if (mortars.length && !mortars.some((m) => m.id === S.sel.m)) S.sel.m = mortars[0].id;
  selM.value = S.sel.m ?? "";
  selT.add(new Option(t("centerOption"), "__center"));
  for (const m of markersInFolder(S.sel.targetFolder).filter((x) => x.type !== "mortar")) selT.add(new Option(m.name, m.id));
  if (![...selT.options].some((o) => o.value === S.sel.t)) S.sel.t = "__center";
  selT.value = S.sel.t;
}
function onFireFolderChanged(): void {
  scheduleSave();
  fillFireSelects();
  fillShellOptions();
  renderFire();
  requestDraw();
}
$<HTMLSelectElement>("selMFolder").onchange = (e) => {
  getCurrent().sel.mortarFolder = (e.target as HTMLSelectElement).value;
  onFireFolderChanged();
};
$<HTMLSelectElement>("selTFolder").onchange = (e) => {
  getCurrent().sel.targetFolder = (e.target as HTMLSelectElement).value;
  onFireFolderChanged();
};
$<HTMLSelectElement>("selM").onchange = (e) => {
  getCurrent().sel.m = (e.target as HTMLSelectElement).value;
  scheduleSave();
  fillShellOptions();
  renderFire();
  requestDraw();
};
$<HTMLSelectElement>("selT").onchange = (e) => {
  const S = getCurrent();
  S.sel.t = (e.target as HTMLSelectElement).value;
  scheduleSave();
  const t = S.markers.find((m) => m.id === S.sel.t);
  if (t) centerOnWorld(t.x, t.z);
  renderFire();
  requestDraw();
};

function fillShellOptions(): void {
  const p = firePair();
  const w: WeaponId = p ? p.m.w : "M252";
  const sel = $<HTMLSelectElement>("selShell");
  sel.textContent = "";
  for (const k of Object.keys(TABLES[w].shells)) sel.add(new Option(shellName(k), k));
  const S = getCurrent();
  if (!TABLES[w].shells[S.sel.shell]) S.sel.shell = "HE";
  sel.value = S.sel.shell;
}
$<HTMLSelectElement>("selShell").onchange = (e) => {
  getCurrent().sel.shell = (e.target as HTMLSelectElement).value;
  scheduleSave();
  renderFire();
};
$<HTMLSelectElement>("selCharge").onchange = (e) => {
  getCurrent().sel.charge = Number((e.target as HTMLSelectElement).value);
  scheduleSave();
  renderTable(lastDist);
};

let lastDist: number | null = null;

export function renderFire(): void {
  const box = $("sol");
  const p = firePair();
  if (!p) {
    box.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("fireEmpty");
    box.appendChild(empty);
    $("tblBox").hidden = true;
    return;
  }
  $("tblBox").hidden = false;
  const w = p.m.w;
  const weapon = TABLES[w];
  const S = getCurrent();
  if (!weapon.shells[S.sel.shell]) S.sel.shell = "HE";
  const selShell = $<HTMLSelectElement>("selShell");
  if (selShell.options.length === 0 || !weapon.shells[selShell.value] || selShell.dataset.w !== w) {
    fillShellOptions();
    selShell.dataset.w = w;
  }

  const dx = p.t.x - p.m.x;
  const dz = p.t.z - p.m.z;
  const dist = Math.hypot(dx, dz);
  lastDist = dist;
  const b = bearing(dx, dz, weapon.milsPerCircle);
  const dh =
    p.m.h !== null && isFinite(p.m.h) && p.t.h !== null && p.t.h !== undefined && isFinite(p.t.h)
      ? p.t.h - p.m.h
      : null;
  const sols = solve(w, S.sel.shell, Math.round(dist), dh);

  box.innerHTML = "";
  const hero = document.createElement("div");
  hero.className = "solution-hero";
  const meta = document.createElement("div");
  meta.className = "solution-meta";
  const cell = (into: HTMLElement, k: string, v: string, u?: string) => {
    const d = document.createElement("div");
    const kk = document.createElement("div");
    kk.className = "k";
    kk.textContent = k;
    const vv = document.createElement("div");
    vv.className = "v";
    vv.textContent = v;
    if (u) {
      const uu = document.createElement("span");
      uu.className = "u";
      uu.textContent = u;
      vv.appendChild(uu);
    }
    d.append(kk, vv);
    into.appendChild(d);
  };
  cell(hero, t("cellAzimuthMils", { circle: weapon.milsPerCircle }), String(b.mils));
  cell(
    hero,
    sols.length ? t("cellElevationMilsCharge", { c: sols[0].charge }) : t("cellElevationMils"),
    sols.length ? String(sols[0].elevation) : "—"
  );
  cell(meta, t("cellRange"), fmtM(dist), t("unitM"));
  cell(meta, t("cellAzimuth"), b.deg.toFixed(1), "°");
  cell(meta, t("cellHeightDiff"), dh === null ? "—" : (dh > 0 ? "+" : "") + fmtM(dh), dh === null ? undefined : t("unitM"));
  box.append(hero, meta);

  if (!sols.length) {
    const r = shellRange(w, S.sel.shell);
    const warn = document.createElement("p");
    warn.className = "warn";
    warn.textContent = t("outOfRange", { weapon: weaponName(w), min: r.min, max: r.max });
    box.appendChild(warn);
  } else {
    const table = document.createElement("table");
    table.className = "charges";
    table.innerHTML = `<thead><tr><th>${t("colCharge")}</th><th>${t("cellElevationMils")}</th><th>${t("colTof")}</th></tr></thead>`;
    const tbody = document.createElement("tbody");
    sols.forEach((o, i) => {
      const tr = document.createElement("tr");
      if (i === 0) tr.className = "best";
      const a = document.createElement("td");
      a.textContent = String(o.charge) + (i === 0 ? "  ★" : "");
      const el = document.createElement("td");
      el.className = "el";
      el.textContent = String(o.elevation);
      const tof = document.createElement("td");
      tof.textContent = o.timeOfFlight == null ? "—" : o.timeOfFlight.toFixed(1);
      tr.append(a, el, tof);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    box.appendChild(table);
    const note = document.createElement("p");
    note.className = "hint";
    note.style.margin = "6px 0 0";
    note.textContent = t("bestChargeNote");
    box.appendChild(note);
    if (S.sel.charge === null || !sols.some((o) => o.charge === S.sel.charge)) S.sel.charge = sols[0].charge;

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn small";
    saveBtn.style.marginTop = "8px";
    saveBtn.textContent = t("saveToLogBtn");
    saveBtn.onclick = () => {
      const best = sols[0];
      addFireLogEntry({
        mortarName: p.m.name,
        mortarGrid: gridRef(p.m.x, p.m.z),
        targetName: p.t.name,
        targetGrid: gridRef(p.t.x, p.t.z),
        weapon: w,
        shell: S.sel.shell,
        charge: best.charge,
        elevation: best.elevation,
        bearingMils: b.mils,
        milsPerCircle: weapon.milsPerCircle,
        range: dist,
        heightDiff: dh,
        tof: best.timeOfFlight ?? null
      });
      toast(t("savedToLog"));
      if (!$("pane-log").hidden) renderLog();
    };
    box.appendChild(saveBtn);
  }

  const note2 = document.createElement("p");
  note2.className = "hint";
  note2.style.marginTop = "8px";
  note2.textContent =
    `${weaponName(w)} «${p.m.name}» ${gridRef(p.m.x, p.m.z)}  →  «${p.t.name}» ${gridRef(p.t.x, p.t.z)}` +
    (dh === null ? t("noHeightNote") : "");
  box.appendChild(note2);
  renderTable(dist);
}

function renderTable(dist: number | null): void {
  const p = firePair();
  if (!p) return;
  const S = getCurrent();
  const shell = TABLES[p.m.w].shells[S.sel.shell];
  if (!shell) return;
  const csSel = $<HTMLSelectElement>("selCharge");
  const key = p.m.w + S.sel.shell;
  if (csSel.dataset.k !== key) {
    csSel.textContent = "";
    for (const c of shell.charges) csSel.add(new Option(`${c.level}  (${c.minRange}–${c.maxRange} ${t("unitM")})`, String(c.level)));
    csSel.dataset.k = key;
  }
  if (!shell.charges.some((c) => c.level === S.sel.charge)) S.sel.charge = shell.charges[0].level;
  csSel.value = String(S.sel.charge);
  const charge = shell.charges.find((c) => c.level === S.sel.charge)!;

  let near: number | null = null;
  if (dist != null) {
    let bd = 1e9;
    for (const row of charge.table) {
      const d = Math.abs(row.range - dist);
      if (d < bd) {
        bd = d;
        near = row.range;
      }
    }
  }
  const table = document.createElement("table");
  table.className = "rt";
  table.innerHTML = `<thead><tr><th>${t("colRangeM")}</th><th>${t("cellElevationMils")}</th><th>${t("colDeltaPer100")}</th><th>${t("colTof")}</th></tr></thead>`;
  const tbody = document.createElement("tbody");
  for (const row of charge.table) {
    const tr = document.createElement("tr");
    if (row.range === near) tr.className = "hit";
    for (const v of [row.range, row.elevation, row.dElev, row.tof]) {
      const td = document.createElement("td");
      td.textContent = String(v);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  const box = $("rtable");
  box.textContent = "";
  box.appendChild(table);
  const cap = document.createElement("p");
  cap.className = "hint";
  cap.textContent = t("tableCaption", { weapon: weaponName(p.m.w), shell: shellName(S.sel.shell), shellName: shell.name, level: charge.level });
  box.appendChild(cap);
}

// ---------- fire log ----------
function renderLog(): void {
  const ul = $("logList");
  ul.textContent = "";
  const S = getCurrent();
  const entries = [...S.fireLog].reverse();
  if (!entries.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = t("logEmpty");
    ul.appendChild(li);
    return;
  }
  for (const e of entries) {
    const li = document.createElement("li");
    const badge = document.createElement("div");
    badge.className = "badge b-mortar";
    const bs = document.createElement("span");
    bs.textContent = t("badgeMortar");
    badge.appendChild(bs);
    const info = document.createElement("div");
    info.className = "info";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = `${e.mortarName} ${e.mortarGrid}  →  ${e.targetName} ${e.targetGrid}`;
    const main = document.createElement("div");
    main.className = "sub";
    main.textContent = t("logEntryMils", { bearing: e.bearingMils, elevation: e.elevation });
    const meta = document.createElement("div");
    meta.className = "sub";
    meta.textContent =
      t("logEntryMeta", { weapon: weaponName(e.weapon), shell: shellName(e.shell), charge: e.charge, range: Math.round(e.range) }) +
      "  •  " + new Date(e.at).toLocaleString();
    info.append(name, main, meta);
    const delBtn = document.createElement("button");
    delBtn.className = "btn small";
    delBtn.textContent = t("deleteBtn");
    delBtn.onclick = () => {
      S.fireLog = S.fireLog.filter((x) => x.id !== e.id);
      scheduleSave();
      renderLog();
    };
    li.append(badge, info, delBtn);
    ul.appendChild(li);
  }
}
$<HTMLButtonElement>("clearLog").onclick = async () => {
  const S = getCurrent();
  if (!S.fireLog.length) return;
  const ok = await ask(t("clearLogTitle"), t("clearLogText", { n: S.fireLog.length, terrain: currentMeta().name }), t("deleteBtn"));
  if (ok) {
    S.fireLog = [];
    scheduleSave();
    renderLog();
  }
};

// ---------- setup pane ----------
function renderSetup(): void {
  const S = getCurrent();
  const meta = currentMeta();
  $("modeSize").setAttribute("aria-pressed", String(S.calib.mode === "size"));
  $("modePts").setAttribute("aria-pressed", String(S.calib.mode === "points"));
  $("sizeBox").hidden = S.calib.mode !== "size";
  $("ptsBox").hidden = S.calib.mode !== "points";
  $<HTMLInputElement>("size").value = String(S.calib.size);
  $<HTMLInputElement>("sizeZ").value = String(S.calib.sizeZ);
  $<HTMLButtonElement>("presetSize").textContent = `${meta.name} ${meta.sizeX}×${meta.sizeZ}`;
  $("placesToggle").hidden = false;
  ($("placesToggle") as HTMLInputElement).checked = getRoot().showPlaces;
  $<HTMLButtonElement>("downloadImport").hidden = !meta.preset?.mapImage;
  $("mapInfo").hidden = true;
  $("customRow").hidden = !!meta.preset;
  if (S.calib.mode === "points") renderCalibBoxes();
}

$<HTMLButtonElement>("modeSize").onclick = () => {
  getCurrent().calib.mode = "size";
  scheduleSave();
  renderSetup();
  requestDraw();
};
$<HTMLButtonElement>("modePts").onclick = () => {
  getCurrent().calib.mode = "points";
  scheduleSave();
  renderSetup();
  requestDraw();
};
$<HTMLInputElement>("size").addEventListener("change", (e) => {
  const v = parseFloat((e.target as HTMLInputElement).value);
  if (v >= 100) {
    getCurrent().calib.size = v;
    scheduleSave();
    resetView();
  }
});
$<HTMLInputElement>("sizeZ").addEventListener("change", (e) => {
  const v = parseFloat((e.target as HTMLInputElement).value);
  if (v >= 100) {
    getCurrent().calib.sizeZ = v;
    scheduleSave();
    resetView();
  }
});
$<HTMLButtonElement>("presetSize").onclick = () => {
  const meta = currentMeta();
  getCurrent().calib.size = meta.sizeX;
  getCurrent().calib.sizeZ = meta.sizeZ;
  scheduleSave();
  renderSetup();
  resetView();
};

let calibPick: "a" | "b" | null = null;
function renderCalibBoxes(): void {
  for (const key of ["a", "b"] as const) {
    const box = $("box" + key.toUpperCase());
    box.textContent = "";
    const p = getCurrent().calib[key];
    const title = document.createElement("div");
    title.className = "t";
    title.textContent = t("pointLabel", { k: key.toUpperCase() }) + (p ? "" : t("pointNotFixed"));
    box.appendChild(title);
    const row = document.createElement("div");
    row.className = "row";
    const mk = (label: string, val: number, field: "x" | "z") => {
      const wrap = document.createElement("div");
      wrap.className = "field";
      const l = document.createElement("label");
      l.textContent = label;
      const input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      input.value = isFinite(val) ? String(val) : "";
      input.disabled = !p;
      input.onchange = () => {
        const v = parseFloat(input.value);
        const c = getCurrent().calib[key];
        if (c) {
          c[field] = isFinite(v) ? v : NaN;
          scheduleSave();
          requestDraw();
        }
      };
      wrap.append(l, input);
      return wrap;
    };
    row.append(mk(t("labelXm"), p ? p.x : NaN, "x"), mk(t("labelZm"), p ? p.z : NaN, "z"));
    const btn = document.createElement("button");
    btn.className = "btn small";
    btn.style.alignSelf = "flex-end";
    btn.textContent = p ? t("refixBtn") : t("aimBtn");
    btn.onclick = () => {
      calibPick = key;
      $("placeBtnLabel").textContent = t("fixPointBtn", { k: key.toUpperCase() });
      toast(t("aimAndFix", { k: key.toUpperCase() }));
    };
    row.appendChild(btn);
    box.appendChild(row);
  }
}

function fixCalibAtCenter(key: "a" | "b"): void {
  const p = centerPx();
  const S = getCurrent();
  const old = S.calib[key];
  S.calib[key] = { px: p.px, py: p.py, x: old?.x ?? NaN, z: old?.z ?? NaN };
  calibPick = null;
  $("placeBtnLabel").textContent = t("placeBtn");
  scheduleSave();
  renderSetup();
  requestDraw();
  toast(t("pointFixed", { k: key.toUpperCase() }));
  showTab("setup");
}

// ---------- backup ----------
$<HTMLButtonElement>("copyJson").onclick = () => copyText(JSON.stringify({ markers: getCurrent().markers }, null, 1));
$<HTMLButtonElement>("importJson").onclick = () => {
  try {
    const raw = JSON.parse($<HTMLTextAreaElement>("json").value);
    const arr = Array.isArray(raw.markers) ? raw.markers : Array.isArray(raw) ? raw : null;
    if (!arr) throw new Error("bad");
    const S = getCurrent();
    const ids = new Set(S.markers.map((m) => m.id));
    let count = 0;
    for (const m of arr) {
      if (!m || !isFinite(m.x) || !isFinite(m.z)) continue;
      const marker: Marker = {
        id: ids.has(m.id) ? uid() : String(m.id ?? uid()),
        name: String(m.name ?? "").slice(0, 40),
        type: m.type === "mortar" || m.type === "target" ? m.type : "point",
        x: Number(m.x),
        z: Number(m.z),
        h: m.h === null || m.h === undefined || m.h === "" ? null : Number(m.h),
        w: m.w === "2B14" ? "2B14" : "M252",
        folder: typeof m.folder === "string" ? m.folder.slice(0, 40) : ""
      };
      S.markers.push(marker);
      count++;
    }
    if (!count) throw new Error("empty");
    scheduleSave();
    renderAll();
    $<HTMLTextAreaElement>("json").value = "";
    toast(t("importedCount", { n: count }));
  } catch {
    toast(t("importedNotMarks"));
  }
};
$<HTMLButtonElement>("wipe").onclick = async () => {
  const S = getCurrent();
  if (!S.markers.length) return;
  const ok = await ask(t("wipeTitle"), t("wipeText", { n: S.markers.length, terrain: currentMeta().name }), t("deleteBtn"));
  if (ok) {
    S.markers = [];
    selectedId = null;
    scheduleSave();
    renderAll();
  }
};
$<HTMLInputElement>("placesToggle").onchange = (e) => {
  getRoot().showPlaces = (e.target as HTMLInputElement).checked;
  setShowPlaces(getRoot().showPlaces);
  scheduleSave();
  requestDraw();
};

// ---------- about ----------
function renderAbout(): void {
  const el = document.querySelector("#aboutDlg .about");
  if (!el) return;
  el.innerHTML = t("aboutHtml");
}

// ---------- static hints with embedded links ----------
function renderStaticHints(): void {
  $("fireHint").innerHTML = t("fireHint", {
    link: '<a href="https://github.com/GeNeFRAG/ArmaReforger" target="_blank" rel="noopener">GeNeFRAG/ArmaReforger</a>'
  });
  $("placesHint").innerHTML = t("placesHint", {
    link1: '<a href="https://github.com/nickludlam/EnfusionMapMaker" target="_blank" rel="noopener">EnfusionMapMaker</a>',
    link2: '<a href="https://github.com/GeNeFRAG/ArmaReforger" target="_blank" rel="noopener">GeNeFRAG/ArmaReforger</a>'
  });
}

// ---------- tabs ----------
type TabName = "marks" | "fire" | "log" | "setup";
function showTab(name: TabName): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>(".tabs button")) {
    b.setAttribute("aria-selected", b.dataset.tab === name ? "true" : "false");
  }
  for (const p of ["marks", "fire", "log", "setup"]) $("pane-" + p).hidden = p !== name;
  if (name === "fire") {
    fillFireSelects();
    fillShellOptions();
    $("selShell").removeAttribute("data-w");
    renderFire();
  }
  if (name === "log") renderLog();
  if (name === "setup") {
    renderSetup();
    void refreshLanPanel();
  }
}
document.querySelector(".tabs")!.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (b) showTab(b.dataset.tab as TabName);
});

// ---------- terrain select ----------
function fillTerrainSelect(): void {
  const sel = $<HTMLSelectElement>("terrainSel");
  sel.textContent = "";
  const g1 = document.createElement("optgroup");
  g1.label = t("groupOfficial");
  const g2 = document.createElement("optgroup");
  g2.label = t("groupMods");
  const g3 = document.createElement("optgroup");
  g3.label = t("groupCustom");
  for (const p of PRESETS) (p.official ? g1 : g2).appendChild(new Option(p.name, p.id));
  for (const c of getRoot().customTerrains) g3.appendChild(new Option(c.name, c.id));
  sel.append(g1, g2);
  if (g3.children.length) sel.appendChild(g3);
  // Налаштування карти (розмір, калібрування, зображення) — лише на ПК, тож і додавати власний терен звідси нема сенсу.
  if (!isRemote) sel.add(new Option(t("addOtherTerrain"), "__add"));
  sel.value = getRoot().cur;
}
$<HTMLSelectElement>("terrainSel").onchange = async (e) => {
  const sel = e.target as HTMLSelectElement;
  const v = sel.value;
  if (v === "__add") {
    sel.value = getRoot().cur;
    const r = await ask(
      t("otherTerrainTitle"),
      t("otherTerrainText"),
      t("addBtn"),
      [
        { key: "name", label: t("fieldTerrainName") },
        { key: "size", label: t("fieldTerrainSize"), type: "number", value: "10240" }
      ]
    );
    const name = r ? String(r.name || "").trim().slice(0, 40) : "";
    if (!name) return;
    const size = parseFloat(r!.size);
    const id = addCustomTerrain(name, size >= 100 ? size : 12800, size >= 100 ? size : 12800);
    switchTerrain(id);
    fillTerrainSelect();
    onTerrainSwitched();
    if (!isRemote) showTab("setup");
    toast(t("terrainAdded", { name }));
    return;
  }
  switchTerrain(v);
  onTerrainSwitched();
};
$<HTMLButtonElement>("delTerrain")?.addEventListener("click", async () => {
  const meta = currentMeta();
  if (!getRoot().customTerrains.some((c) => c.id === meta.id)) return;
  const ok = await ask(t("delTerrainTitle"), t("delTerrainText", { name: meta.name }), t("deleteBtn"));
  if (!ok) return;
  removeCustomTerrain(meta.id);
  fillTerrainSelect();
  onTerrainSwitched();
});

function onTerrainSwitched(): void {
  selectedId = null;
  setDrawCallbacks({ selectedId });
  resetView();
  renderAll();
  void ensureHeights(renderAll);
  void ensureMapImage(renderAll);
}

function mapKey(): string {
  return getRoot().cur + ":" + JSON.stringify(getCurrent().map ?? null);
}

/** Інший клієнт (телефон чи ПК) змінив спільний стан — перечитуємо його й перемальовуємо UI. */
export async function reloadFromStore(): Promise<void> {
  const before = mapKey();
  const result = applyExternalState(await window.api.store.load());
  if (result === "skipped") return;
  fillTerrainSelect();
  if (result === "terrain-changed") {
    onTerrainSwitched();
    return;
  }
  const S = getCurrent();
  if (selectedId && !S.markers.some((m) => m.id === selectedId)) {
    selectedId = null;
    setDrawCallbacks({ selectedId });
  }
  if (editing) editing = S.markers.find((m) => m.id === editing!.id) ?? editing;
  if (mapKey() !== before) resetView();
  else syncImageSize();
  renderAll();
}

export function renderAll(): void {
  renderMarksList();
  if (!$("pane-fire").hidden) {
    fillFireSelects();
    renderFire();
  }
  if (!$("pane-log").hidden) renderLog();
  if (!$("pane-setup").hidden) renderSetup();
  requestDraw();
}

function onLanguageChanged(): void {
  fillTerrainSelect();
  renderStaticHints();
  if ($<HTMLDialogElement>("aboutDlg").open) renderAbout();
  relocalizeLanPanel();
  renderAll();
}

function initAboutDialog(): void {
  const dlg = $<HTMLDialogElement>("aboutDlg");
  $<HTMLButtonElement>("aboutBtn").onclick = () => {
    renderAbout();
    dlg.showModal();
  };
  $<HTMLButtonElement>("aboutClose").onclick = () => dlg.close();
  // Клік по затемненню поза вікном теж закриває.
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
}

export function initPanels(): void {
  setShowPlaces(getRoot().showPlaces);
  fillTerrainSelect();
  renderStaticHints();
  setTapHandlers({ onMarkerTap: (id) => selectMarker(id, true) });
  startMapImportUi(() => onTerrainSwitched());
  onLangChange(onLanguageChanged);
  initLanPanel();
  initSheet();
  initImmersive();
  initAboutDialog();
  // Імпорт карт і калібрування — тільки в застосунку на ПК; на телефоні вкладки «Карта» нема.
  if (isRemote) document.querySelector<HTMLElement>('.tabs [data-tab="setup"]')!.hidden = true;
  window.api.store.onChanged(() => void reloadFromStore());
  renderAll();
}
