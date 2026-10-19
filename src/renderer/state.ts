import type { Calib } from "@core/geometry";
import { PRESETS, findPreset, DEFAULT_TERRAIN_ID, type TerrainPreset } from "@core/terrains";
import type { WeaponId } from "@core/ballistics";
import type { Lang } from "./i18n";
import { clampPlacesScale, normalizePlacesLevel, type PlaceTier } from "@core/places";
import { webModMap } from "@core/webMirror";
import { defaultSpread, normalizeSpread, type SpreadSettings } from "@core/spread";

export type ThemeName = "green" | "red" | "blue";
export const THEMES: ThemeName[] = ["green", "red", "blue"];

export type MarkerType = "mortar" | "target" | "point";

export interface Marker {
  id: string;
  name: string;
  type: MarkerType;
  x: number;
  z: number;
  h: number | null;
  w: WeaponId;
  /** Місія/папка — порожній рядок означає "без місії". */
  folder: string;
  /** Час останньої правки (мс) — за ним зливаються копії з різних пристроїв. */
  u: number;
  /** Ціль/точку позначено зруйнованою (вручну); у мінометів не буває. */
  destroyed?: boolean;
}

export type MapState = { kind: "none" } | { kind: "pyramid"; width: number; height: number };

/** Збережений результат розрахунку вогню — журнал для перегляду пізніше. */
export interface FireLogEntry {
  id: string;
  at: number;
  mortarName: string;
  mortarGrid: string;
  targetName: string;
  targetGrid: string;
  weapon: WeaponId;
  shell: string;
  charge: number;
  elevation: number;
  bearingMils: number;
  milsPerCircle: number;
  range: number;
  heightDiff: number | null;
  tof: number | null;
}

/** Найбільша кількість записів журналу на терен — старіші відкидаються. */
export const FIRE_LOG_LIMIT = 200;

/** Спеціальне значення folder-фільтра: показувати мітки з усіх папок. */
export const ALL_FOLDERS = "__all";

export interface Selection {
  m: string | null;
  t: string;
  shell: string;
  charge: number | null;
  /** Яку папку/місію зараз показуємо в списку й на карті. */
  folder: string;
  /** З якої папки брати міномети для розрахунку (ALL_FOLDERS = з усіх) — незалежно від folder. */
  mortarFolder: string;
  /** З якої папки брати цілі/точки для розрахунку (ALL_FOLDERS = з усіх). */
  targetFolder: string;
}

export interface TerrainState {
  markers: Marker[];
  calib: Calib;
  /** null/undefined = типово (онлайн-тайли, якщо є в PRESETS, інакше порожня сітка). */
  map: MapState | null;
  sel: Selection;
  heights: { rows: number; cols: number } | null;
  /** Журнал збережених розрахунків вогню, найновіші останні. */
  fireLog: FireLogEntry[];
  /** Надгробки: id видаленої мітки/запису журналу -> час видалення (для злиття між пристроями). */
  deleted: Record<string, number>;
}

export interface CustomTerrainMeta {
  id: string;
  name: string;
  sizeX: number;
  sizeZ: number;
}

export interface RootState {
  v: number;
  showPlaces: boolean;
  /** Масштаб шрифту назв пунктів (0.6–2). */
  placesScale: number;
  /** Показувати пункти з важливістю не нижче: 1 — лише головні, 2 — головні й звичайні, 3 — усі. */
  placesLevel: PlaceTier;
  /** Кільця дальності вибраного міномета на карті. */
  showRings: boolean;
  /** Звук пострілу й влучання. */
  soundShots: boolean;
  /** Колірна тема інтерфейсу (зелена — типова); налаштування пристрою. */
  theme: ThemeName;
  /** Тонувати карту в колір теми (для червоної й синьої). */
  tintMap: boolean;
  /** Розкид снарядів навколо цілі (налаштування користувача, локальне для пристрою). */
  spread: SpreadSettings;
  lang: Lang;
  cur: string;
  customTerrains: CustomTerrainMeta[];
  data: Record<string, TerrainState>;
  /** Надгробки видалених власних теренів. */
  deletedTerrains: Record<string, number>;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function blankTerrain(sizeX: number, sizeZ: number): TerrainState {
  return {
    markers: [],
    calib: { mode: "size", size: sizeX, sizeZ, a: null, b: null },
    map: null,
    sel: { m: null, t: "__center", shell: "HE", charge: null, folder: ALL_FOLDERS, mortarFolder: ALL_FOLDERS, targetFolder: ALL_FOLDERS },
    heights: null,
    fireLog: [],
    deleted: {}
  };
}

function allTerrainMetas(root: RootState): Array<{ id: string; sizeX: number; sizeZ: number }> {
  return [
    ...PRESETS.map((p) => ({ id: p.id, sizeX: p.sizeX, sizeZ: p.sizeZ })),
    ...root.customTerrains.map((c) => ({ id: c.id, sizeX: c.sizeX, sizeZ: c.sizeZ }))
  ];
}

export function blankRoot(): RootState {
  const root: RootState = { v: 1, showPlaces: true, placesScale: 1, placesLevel: 3, showRings: true, soundShots: true, theme: "green", tintMap: true, spread: defaultSpread(), lang: "uk", cur: DEFAULT_TERRAIN_ID, customTerrains: [], data: {}, deletedTerrains: {} };
  for (const p of PRESETS) root.data[p.id] = blankTerrain(p.sizeX, p.sizeZ);
  return root;
}

function normalizeMarker(m: unknown): Marker | null {
  if (!m || typeof m !== "object") return null;
  const r = m as Record<string, unknown>;
  if (!isFinite(Number(r.x)) || !isFinite(Number(r.z))) return null;
  const type: MarkerType = r.type === "mortar" || r.type === "target" ? r.type : "point";
  const h = r.h === null || r.h === undefined || r.h === "" ? null : Number(r.h);
  return {
    id: typeof r.id === "string" ? r.id : uid(),
    name: typeof r.name === "string" ? r.name.slice(0, 40) : "",
    type,
    x: Number(r.x),
    z: Number(r.z),
    h: isFinite(h as number) ? (h as number) : null,
    w: r.w === "2B14" ? "2B14" : "M252",
    folder: typeof r.folder === "string" ? r.folder.slice(0, 40) : "",
    u: isFinite(Number(r.u)) ? Number(r.u) : 0,
    ...(r.destroyed === true && type !== "mortar" ? { destroyed: true } : {})
  };
}

function normalizeTombs(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [id, ts] of Object.entries(v as Record<string, unknown>)) {
      const n = Number(ts);
      if (isFinite(n) && n > 0) out[id] = n;
    }
  }
  return out;
}

function normalizeFireLogEntry(e: unknown): FireLogEntry | null {
  if (!e || typeof e !== "object") return null;
  const r = e as Record<string, unknown>;
  if (!isFinite(Number(r.at)) || !isFinite(Number(r.elevation)) || !isFinite(Number(r.bearingMils))) return null;
  const heightDiff = r.heightDiff === null || r.heightDiff === undefined ? null : Number(r.heightDiff);
  const tof = r.tof === null || r.tof === undefined ? null : Number(r.tof);
  return {
    id: typeof r.id === "string" ? r.id : uid(),
    at: Number(r.at),
    mortarName: typeof r.mortarName === "string" ? r.mortarName.slice(0, 40) : "",
    mortarGrid: typeof r.mortarGrid === "string" ? r.mortarGrid : "",
    targetName: typeof r.targetName === "string" ? r.targetName.slice(0, 40) : "",
    targetGrid: typeof r.targetGrid === "string" ? r.targetGrid : "",
    weapon: r.weapon === "2B14" ? "2B14" : "M252",
    shell: typeof r.shell === "string" ? r.shell : "HE",
    charge: Number(r.charge) || 0,
    elevation: Number(r.elevation),
    bearingMils: Number(r.bearingMils),
    milsPerCircle: isFinite(Number(r.milsPerCircle)) ? Number(r.milsPerCircle) : 6400,
    range: isFinite(Number(r.range)) ? Number(r.range) : 0,
    heightDiff: heightDiff !== null && isFinite(heightDiff) ? heightDiff : null,
    tof: tof !== null && isFinite(tof) ? tof : null
  };
}

function normalizeTerrain(d: unknown, sizeX: number, sizeZ: number): TerrainState {
  const n = blankTerrain(sizeX, sizeZ);
  if (d && typeof d === "object") {
    const r = d as Record<string, unknown>;
    if (Array.isArray(r.markers)) {
      n.markers = r.markers.map(normalizeMarker).filter((m): m is Marker => m !== null);
    }
    if (r.calib && typeof r.calib === "object") Object.assign(n.calib, r.calib);
    if ("map" in r) n.map = r.map as MapState | null;
    if (r.sel && typeof r.sel === "object") Object.assign(n.sel, r.sel);
    for (const key of ["folder", "mortarFolder", "targetFolder"] as const) {
      if (typeof n.sel[key] !== "string") n.sel[key] = ALL_FOLDERS;
    }
    if (r.heights && typeof r.heights === "object") n.heights = r.heights as TerrainState["heights"];
    if (Array.isArray(r.fireLog)) {
      n.fireLog = r.fireLog.map(normalizeFireLogEntry).filter((e): e is FireLogEntry => e !== null).slice(-FIRE_LOG_LIMIT);
    }
    n.deleted = normalizeTombs(r.deleted);
  }
  return n;
}

export function normalizeRoot(raw: unknown): RootState {
  const root = blankRoot();
  if (!raw || typeof raw !== "object") return root;
  const r = raw as Record<string, unknown>;

  if (Array.isArray(r.customTerrains)) {
    for (const t of r.customTerrains) {
      if (!t || typeof t !== "object") continue;
      const c = t as Record<string, unknown>;
      if (typeof c.id !== "string" || !/^c-[a-z0-9]+$/.test(c.id)) continue;
      root.customTerrains.push({
        id: c.id,
        name: String(c.name ?? c.id).slice(0, 40),
        sizeX: Number(c.sizeX) > 0 ? Number(c.sizeX) : 12800,
        sizeZ: Number(c.sizeZ) > 0 ? Number(c.sizeZ) : 12800
      });
    }
  }
  for (const meta of root.customTerrains) root.data[meta.id] = blankTerrain(meta.sizeX, meta.sizeZ);

  const dataObj = (r.data && typeof r.data === "object" ? r.data : {}) as Record<string, unknown>;
  for (const meta of allTerrainMetas(root)) {
    root.data[meta.id] = normalizeTerrain(dataObj[meta.id], meta.sizeX, meta.sizeZ);
    // автономна версія: карта модового терену лежить на сайті (див. core/webMirror.ts)
    if (typeof __STANDALONE__ !== "undefined" && __STANDALONE__) {
      const wm = webModMap(meta.id);
      if (wm) root.data[meta.id].map = { kind: "pyramid", width: wm.width, height: wm.height };
    }
  }

  root.deletedTerrains = normalizeTombs(r.deletedTerrains);
  root.showPlaces = r.showPlaces !== false;
  root.placesScale = clampPlacesScale(r.placesScale);
  root.placesLevel = normalizePlacesLevel(r.placesLevel);
  root.showRings = r.showRings !== false;
  root.soundShots = r.soundShots !== false;
  root.spread = normalizeSpread(r.spread);
  // старе поле night (нічний режим 0.13) -> червона тема
  root.theme = THEMES.includes(r.theme as ThemeName) ? (r.theme as ThemeName) : r.night === true ? "red" : "green";
  root.tintMap = r.tintMap !== false;
  root.lang = r.lang === "en" ? "en" : "uk";
  root.cur = allTerrainMetas(root).some((m) => m.id === r.cur) ? (r.cur as string) : DEFAULT_TERRAIN_ID;
  return root;
}

let ROOT: RootState = blankRoot();

export function getRoot(): RootState {
  return ROOT;
}

export function getCurrent(): TerrainState {
  return ROOT.data[ROOT.cur];
}

export interface TerrainMeta {
  id: string;
  name: string;
  sizeX: number;
  sizeZ: number;
  preset?: TerrainPreset;
}

export function currentMeta(): TerrainMeta {
  const preset = findPreset(ROOT.cur);
  if (preset) return { id: preset.id, name: preset.name, sizeX: preset.sizeX, sizeZ: preset.sizeZ, preset };
  const custom = ROOT.customTerrains.find((c) => c.id === ROOT.cur)!;
  return { id: custom.id, name: custom.name, sizeX: custom.sizeX, sizeZ: custom.sizeZ };
}

/** Мітки поточного терену з урахуванням фільтра папки/місії (ALL_FOLDERS = без фільтра). */
export function getVisibleMarkers(): Marker[] {
  return markersInFolder(getCurrent().sel.folder);
}

/** Мітки поточного терену з однієї папки (ALL_FOLDERS = усі). */
export function markersInFolder(folder: string): Marker[] {
  const S = getCurrent();
  if (folder === ALL_FOLDERS) return S.markers;
  return S.markers.filter((m) => m.folder === folder);
}

/** Відсортований список назв папок/місій, наявних серед міток поточного терену. */
export function getFolderNames(): string[] {
  const S = getCurrent();
  const names = new Set(S.markers.map((m) => m.folder));
  return [...names].sort((a, b) => a.localeCompare(b, "uk"));
}

export async function loadState(): Promise<void> {
  const raw = await window.api.store.load();
  ROOT = normalizeRoot(raw);
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let mergedHook: (() => void) | null = null;

/** Викликається, коли після збереження сервер дозлив у стан чужі правки — UI має перечитати його. */
export function setMergedHook(hook: () => void): void {
  mergedHook = hook;
}

// Після повернення зв'язку відправляємо те, що змінили без ПК (платформа шле mortar:flush).
if (typeof window !== "undefined") window.addEventListener("mortar:flush", () => scheduleSave());

export function scheduleSave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void window.api.store
      .save(ROOT)
      .then((merged) => {
        if (merged && mergedHook) mergedHook();
      })
      .catch(() => undefined);
  }, 400);
}

/** Позначає мітку/запис журналу видаленими (надгробок) у поточному тереині. */
export function markDeleted(id: string): void {
  getCurrent().deleted[id] = Date.now();
}

export type ExternalApply = "skipped" | "applied" | "terrain-changed";

/** Що змінилось у спільному стані після чужої правки (мітки й журнал) — для сповіщення. */
export interface ExternalSummary {
  added: string[];
  changed: string[];
  removed: string[];
  logAdded: number;
}
let lastSummary: ExternalSummary | null = null;

/** Забирає зведення останньої зовнішньої зміни (одноразово). */
export function takeExternalSummary(): ExternalSummary | null {
  const s = lastSummary;
  lastSummary = null;
  return s;
}

function summarizeChanges(prev: RootState, next: RootState): ExternalSummary | null {
  const out: ExternalSummary = { added: [], changed: [], removed: [], logAdded: 0 };
  for (const [tid, nt] of Object.entries(next.data)) {
    const pt = prev.data[tid];
    if (!pt) continue;
    const before = new Map(pt.markers.map((m) => [m.id, m]));
    const after = new Map(nt.markers.map((m) => [m.id, m]));
    for (const [id, m] of after) {
      const old = before.get(id);
      const label = m.name || m.type;
      if (!old) out.added.push(label);
      else if (JSON.stringify(old) !== JSON.stringify(m)) out.changed.push(label);
    }
    for (const [id, m] of before) if (!after.has(id)) out.removed.push(m.name || m.type);
    const oldLog = new Set(pt.fireLog.map((l) => l.id));
    out.logAdded += nt.fireLog.filter((l) => !oldLog.has(l.id)).length;
  }
  return out.added.length || out.changed.length || out.removed.length || out.logAdded ? out : null;
}

/**
 * Підхоплює стан, збережений іншим клієнтом (телефон <-> ПК). Мова, поточний терен і вибір
 * (міномет/ціль/снаряд/папка) лишаються локальними — кожен екран рахує своє, а мітки й журнал спільні.
 * Якщо тут є ще не збережені зміни — нічого не чіпаємо (наш запис піде слідом і перекриє).
 */
export function applyExternalState(raw: unknown): ExternalApply {
  if (saveTimer !== undefined) return "skipped";
  const next = normalizeRoot(raw);
  const prev = ROOT;
  next.lang = prev.lang;
  // розмір і рівень назв — налаштування екрана (телефон і ПК мають різні)
  next.placesScale = prev.placesScale;
  next.placesLevel = prev.placesLevel;
  next.showRings = prev.showRings;
  next.soundShots = prev.soundShots;
  next.spread = prev.spread;
  next.theme = prev.theme;
  next.tintMap = prev.tintMap;
  lastSummary = summarizeChanges(prev, next);
  for (const id of Object.keys(next.data)) {
    if (prev.data[id]) next.data[id].sel = prev.data[id].sel;
  }
  const terrainStillExists = !!next.data[prev.cur];
  if (terrainStillExists) next.cur = prev.cur;
  ROOT = next;
  return terrainStillExists ? "applied" : "terrain-changed";
}

export function switchTerrain(id: string): void {
  // власний ключ, а не успадкований: id із чужого посилання на кшталт "__proto__" не має стати поточним теренем
  if (!Object.hasOwn(ROOT.data, id)) return;
  ROOT.cur = id;
  scheduleSave();
}

export function addCustomTerrain(name: string, sizeX: number, sizeZ: number): string {
  const id = "c-" + uid();
  ROOT.customTerrains.push({ id, name, sizeX, sizeZ });
  ROOT.data[id] = blankTerrain(sizeX, sizeZ);
  scheduleSave();
  return id;
}

export function addFireLogEntry(entry: Omit<FireLogEntry, "id" | "at">): void {
  const S = getCurrent();
  S.fireLog.push({ ...entry, id: uid(), at: Date.now() });
  if (S.fireLog.length > FIRE_LOG_LIMIT) S.fireLog.splice(0, S.fireLog.length - FIRE_LOG_LIMIT);
  scheduleSave();
}

export function removeCustomTerrain(id: string): void {
  ROOT.deletedTerrains[id] = Date.now();
  ROOT.customTerrains = ROOT.customTerrains.filter((c) => c.id !== id);
  delete ROOT.data[id];
  if (ROOT.cur === id) ROOT.cur = DEFAULT_TERRAIN_ID;
  scheduleSave();
}
