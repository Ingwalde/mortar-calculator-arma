import { describe, expect, it } from "vitest";
import { FIRE_LOG_CAP, mergeRoots } from "./merge";

const NOW = 1_700_000_000_000;

interface TestRoot {
  v: number;
  cur: string;
  customTerrains: Array<{ id: string; name?: string }>;
  data: Record<string, Record<string, unknown>>;
  [k: string]: unknown;
}
function root(terrain: Record<string, unknown>, extra: Record<string, unknown> = {}): TestRoot {
  return { v: 1, cur: "everon", customTerrains: [], data: { everon: { markers: [], fireLog: [], deleted: {}, ...terrain } }, ...extra };
}
const mk = (id: string, u: number, name = id) => ({ id, name, type: "target", x: 1, z: 2, h: null, w: "M252", folder: "", u });
const log = (id: string, at: number) => ({ id, at, elevation: 1000, bearingMils: 100 });
type Root = TestRoot;
const markers = (r: unknown) => ((r as Root).data.everon as { markers: Array<{ id: string; name: string }> }).markers;

describe("mergeRoots", () => {
  it("keeps a marker added elsewhere while this client saves its own change", () => {
    const base = root({ markers: [mk("a", 10), mk("b", 20)] });
    const incoming = root({ markers: [mk("a", 10), mk("c", 30)] });
    const { state, changed } = mergeRoots(base, incoming, NOW);
    expect(markers(state).map((m) => m.id).sort()).toEqual(["a", "b", "c"]);
    expect(changed).toBe(true);
  });

  it("is a no-op when nothing differs", () => {
    const s = root({ markers: [mk("a", 10)], fireLog: [log("l1", 5)] });
    const { state, changed } = mergeRoots(s, s, NOW);
    expect(changed).toBe(false);
    expect(markers(state).map((m) => m.id)).toEqual(["a"]);
  });

  it("takes the newer edit of the same marker", () => {
    const base = root({ markers: [mk("a", 50, "новa")] });
    const stale = root({ markers: [mk("a", 10, "стара")] });
    const { state, changed } = mergeRoots(base, stale, NOW);
    expect(markers(state)[0].name).toBe("новa");
    expect(changed).toBe(true);
    const fresh = root({ markers: [mk("a", 90, "найновіша")] });
    expect(markers(mergeRoots(base, fresh, NOW).state)[0].name).toBe("найновіша");
  });

  it("does not resurrect a marker deleted by the saving client", () => {
    const base = root({ markers: [mk("a", 10), mk("b", 20)] });
    const incoming = root({ markers: [mk("a", 10)], deleted: { b: NOW - 1000 } });
    const { state } = mergeRoots(base, incoming, NOW);
    expect(markers(state).map((m) => m.id)).toEqual(["a"]);
  });

  it("drops a stale copy of a marker that another client deleted", () => {
    const base = root({ markers: [mk("a", 10)], deleted: { b: NOW - 500 } });
    const stale = root({ markers: [mk("a", 10), mk("b", 20)] });
    const { state, changed } = mergeRoots(base, stale, NOW);
    expect(markers(state).map((m) => m.id)).toEqual(["a"]);
    expect(changed).toBe(true);
  });

  it("lets an edit made after the deletion win", () => {
    const base = root({ markers: [], deleted: { b: NOW - 5000 } });
    const incoming = root({ markers: [mk("b", NOW - 100)] });
    expect(markers(mergeRoots(base, incoming, NOW).state).map((m) => m.id)).toEqual(["b"]);
  });

  it("merges fire log entries and caps them to the newest", () => {
    const many = Array.from({ length: FIRE_LOG_CAP + 20 }, (_, i) => log("l" + i, i + 1));
    const base = root({ fireLog: many.slice(0, 150) });
    const incoming = root({ fireLog: many.slice(100) });
    const merged = (mergeRoots(base, incoming, NOW).state as Root).data.everon as { fireLog: Array<{ at: number }> };
    expect(merged.fireLog.length).toBe(FIRE_LOG_CAP);
    expect(Math.max(...merged.fireLog.map((e) => e.at))).toBe(FIRE_LOG_CAP + 20);
    expect(Math.min(...merged.fireLog.map((e) => e.at))).toBe(21);
  });

  it("keeps the saving client's scalar fields", () => {
    const base = root({ calib: { size: 100 } }, { cur: "arland", lang: "uk" });
    const incoming = root({ calib: { size: 999 } }, { cur: "everon", lang: "en" });
    const s = mergeRoots(base, incoming, NOW).state as Root & { lang: string };
    expect(s.cur).toBe("everon");
    expect(s.lang).toBe("en");
    expect((s.data.everon as { calib: { size: number } }).calib.size).toBe(999);
  });

  it("unions custom terrains and honours terrain tombstones", () => {
    const base = root({}, { customTerrains: [{ id: "c-1", name: "A" }, { id: "c-2", name: "B" }] });
    base.data = { ...base.data, "c-1": { markers: [mk("m", 1)], fireLog: [], deleted: {} } };
    const incoming = root({}, { customTerrains: [{ id: "c-2", name: "B" }], deletedTerrains: { "c-2": NOW - 10 } });
    const s = mergeRoots(base, incoming, NOW).state as Root & { customTerrains: Array<{ id: string }>; data: Record<string, unknown> };
    expect(s.customTerrains.map((c) => c.id)).toEqual(["c-1"]);
    expect("c-1" in s.data).toBe(true);
  });

  it("prunes tombstones older than the TTL", () => {
    const old = NOW - 31 * 24 * 60 * 60 * 1000;
    const incoming = root({ deleted: { gone: old, recent: NOW - 1000 } });
    const merged = (mergeRoots(root({}), incoming, NOW).state as Root).data.everon as { deleted: Record<string, number> };
    expect(Object.keys(merged.deleted)).toEqual(["recent"]);
  });

  it("returns the base when the incoming state is garbage", () => {
    const base = root({ markers: [mk("a", 1)] });
    expect(mergeRoots(base, null, NOW).state).toBe(base);
    expect(mergeRoots(null, base, NOW).state).toBe(base);
  });

  it("порожній клієнт не стирає карту й висоти терену", () => {
    const base = { data: { bad: { map: { kind: "pyramid", width: 100, height: 100 }, heights: { rows: 3, cols: 3 }, markers: [], fireLog: [], deleted: {} } } };
    const blank = { data: { bad: { map: null, heights: null, markers: [], fireLog: [], deleted: {} } } };
    const r = mergeRoots(base, blank);
    const d = (r.state as { data: { bad: { map: unknown; heights: unknown } } }).data.bad;
    expect(d.map).toEqual({ kind: "pyramid", width: 100, height: 100 });
    expect(d.heights).toEqual({ rows: 3, cols: 3 });
    expect(r.changed).toBe(true);
  });

  it("{kind:none} — це явне «без карти», його зберігаємо", () => {
    const base = { data: { bad: { map: { kind: "pyramid", width: 1, height: 1 }, markers: [], fireLog: [], deleted: {} } } };
    const inc = { data: { bad: { map: { kind: "none" }, markers: [], fireLog: [], deleted: {} } } };
    const d = (mergeRoots(base, inc).state as { data: { bad: { map: unknown } } }).data.bad;
    expect(d.map).toEqual({ kind: "none" });
  });
});

describe("mergeRoots: дельта (partial)", () => {
  const terr = (n: number) => ({ map: null, markers: [{ id: "m" + n, u: 1 }], fireLog: [], deleted: {} });
  it("терен, якого нема в дельті, береться з бази й не вважається чужою правкою", () => {
    const base = { data: { a: terr(1), b: terr(2) } };
    const delta = { data: { a: terr(1) } };
    const r = mergeRoots(base, delta, Date.now(), { partial: true });
    const d = (r.state as { data: Record<string, unknown> }).data;
    expect(Object.keys(d).sort()).toEqual(["a", "b"]);
    expect(r.changed).toBe(false);
  });
  it("без partial відсутній терен означає, що клієнт про нього не знає (потрібно перечитати)", () => {
    const base = { data: { a: terr(1), b: terr(2) } };
    const r = mergeRoots(base, { data: { a: terr(1) } });
    expect(r.changed).toBe(true);
  });
});

describe("mergeRoots: чужий JSON із небезпечними ключами", () => {
  it("ігнорує __proto__/constructor і не чіпає прототипи", () => {
    const evil = JSON.parse(
      '{"data":{"__proto__":{"polluted":true},"constructor":{"x":1},"ok":{"markers":[],"fireLog":[],"deleted":{}}},' +
        '"deletedTerrains":{"__proto__":123456789012345}}'
    );
    const r = mergeRoots({ data: {} }, evil, Date.now());
    const state = r.state as { data: Record<string, unknown>; deletedTerrains: Record<string, number> };
    expect(Object.keys(state.data)).toEqual(["ok"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(state.data)).toBe(Object.prototype);
    expect(Object.keys(state.deletedTerrains)).toEqual([]);
  });
});
