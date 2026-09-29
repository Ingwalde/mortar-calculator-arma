import type { Calib } from "@core/geometry";
import { PRESETS, findPreset, DEFAULT_TERRAIN_ID, type TerrainPreset } from "@core/terrains";
import type { WeaponId } from "@core/ballistics";
import type { Lang } from "./i18n";

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
}

export type MapState = { kind: "none" } | { kind: "pyramid"; width: number; height: number };

/** Спеціальне значення folder-фільтра: показувати мітки з усіх папок. */
export const ALL_FOLDERS = "__all";

export interface Selection {
  m: string | null;
  t: string;
  shell: string;
  charge: number | null;
  /** Яку папку/місію зараз показуємо в списку, на карті й у розрахунку. */
  folder: string;
}

export interface TerrainState {
  markers: Marker[];
  calib: Calib;
  /** null/undefined = типово (онлайн-тайли, якщо є в PRESETS, інакше порожня сітка). */
  map: MapState | null;
  sel: Selection;
  heights: { rows: number; cols: number } | null;
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
  lang: Lang;
  cur: string;
  customTerrains: CustomTerrainMeta[];
  data: Record<string, TerrainState>;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function blankTerrain(sizeX: number, sizeZ: number): TerrainState {
  return {
    markers: [],
    calib: { mode: "size", size: sizeX, sizeZ, a: null, b: null },
    map: null,
    sel: { m: null, t: "__center", shell: "HE", charge: null, folder: ALL_FOLDERS },
    heights: null
  };
}

function allTerrainMetas(root: RootState): Array<{ id: string; sizeX: number; sizeZ: number }> {
  return [
    ...PRESETS.map((p) => ({ id: p.id, sizeX: p.sizeX, sizeZ: p.sizeZ })),
    ...root.customTerrains.map((c) => ({ id: c.id, sizeX: c.sizeX, sizeZ: c.sizeZ }))
  ];
}

export function blankRoot(): RootState {
  const root: RootState = { v: 1, showPlaces: true, lang: "uk", cur: DEFAULT_TERRAIN_ID, customTerrains: [], data: {} };
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
    folder: typeof r.folder === "string" ? r.folder.slice(0, 40) : ""
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
    if (r.heights && typeof r.heights === "object") n.heights = r.heights as TerrainState["heights"];
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
  }

  root.showPlaces = r.showPlaces !== false;
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
  const S = getCurrent();
  if (S.sel.folder === ALL_FOLDERS) return S.markers;
  return S.markers.filter((m) => m.folder === S.sel.folder);
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
export function scheduleSave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void window.api.store.save(ROOT);
  }, 400);
}

export function switchTerrain(id: string): void {
  if (!ROOT.data[id]) return;
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

export function removeCustomTerrain(id: string): void {
  ROOT.customTerrains = ROOT.customTerrains.filter((c) => c.id !== id);
  delete ROOT.data[id];
  if (ROOT.cur === id) ROOT.cur = DEFAULT_TERRAIN_ID;
  scheduleSave();
}
