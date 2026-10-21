/**
 * Звіт після гри (docs/squad-mode.md, розділ 11): будується сервером із даних відділення, правиться командиром і тими,
 * кому він дозволив, зберігається у файл і відкривається потім для перегляду. Тут лише дані й чисті функції —
 * однакові для сервера й клієнта, тому правки застосовуються однаково на обох боках.
 */
import type { SquadState } from "./room";
import type { Role, SquadKind } from "./protocol";
import { LIMITS } from "./protocol";
import type { Affiliation } from "../marks";

export const REPORT_SCHEMA = "mortar-tablet-report/1";

export const REPORT_LIMITS = {
  title: 80,
  notes: 4000,
  /** Скільки міток і записів журналу потрапляє у звіт: звіт має вміститися в одне значення сховища (128 КіБ). */
  marks: 150,
  fire: 100
} as const;

export interface ReportMember {
  id: string;
  callsign: string;
  role: Role;
  removed: boolean;
  joinedAt: number;
}

export interface ReportMark {
  id: string;
  aff: Affiliation;
  kind: SquadKind;
  name: string;
  caption: string;
  x: number;
  z: number;
  h: number | null;
  w: string;
  destroyed: boolean;
  /** Позивний автора й час створення. */
  by: string;
  at: number;
  /** Позивний того, хто змінив останнім, і час. */
  ub: string;
  ut: number;
  deletedAt?: number;
  deletedBy?: string;
  /** Виключено з підсумків при редагуванні звіту. */
  excluded?: boolean;
}

export interface ReportFire {
  id: string;
  at: number;
  by: string;
  mortar: string;
  target: string;
  weapon: string;
  shell: string;
  charge: number;
  elevation: number;
  bearingMils: number;
  range: number;
  warnings: number;
}

export interface Report {
  schema: typeof REPORT_SCHEMA;
  title: string;
  notes: string;
  terrain: string;
  startedAt: number;
  endedAt: number;
  members: ReportMember[];
  marks: ReportMark[];
  fire: ReportFire[];
}

export type ReportEdit =
  | { k: "title"; value: string }
  | { k: "notes"; value: string }
  | { k: "mark"; id: string; name?: string; caption?: string; destroyed?: boolean; excluded?: boolean };

const num = (v: unknown, d = 0): number => (typeof v === "number" && isFinite(v) ? v : d);
const str = (v: unknown, max = 200): string => (typeof v === "string" ? v.slice(0, max) : "");

/** Будує звіт зі стану відділення в момент закінчення гри. */
export function buildReport(s: SquadState, now: number): Report {
  const name = (id: string | undefined): string => (id ? (s.members[id]?.callsign ?? "?") : "?");
  const members = Object.values(s.members)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((m) => ({ id: m.id, callsign: m.callsign, role: m.role, removed: m.removed, joinedAt: m.joinedAt }));
  const all = Object.values(s.marks).sort((a, b) => a.at - b.at);
  // у звіт потрапляють усі живі мітки й найновіші видалені — в межах ліміту
  const live = all.filter((m) => !m.del);
  const dead = all.filter((m) => m.del).slice(-Math.max(0, REPORT_LIMITS.marks - live.length));
  const marks: ReportMark[] = [...live, ...dead]
    .slice(0, REPORT_LIMITS.marks)
    .sort((a, b) => a.at - b.at)
    .map((m) => ({
      id: m.id,
      aff: m.aff,
      kind: m.kind,
      name: m.name,
      caption: m.caption,
      x: m.x,
      z: m.z,
      h: m.u,
      w: m.w,
      destroyed: m.destroyed,
      by: name(m.by),
      at: m.at,
      ub: name(m.ub),
      ut: m.ut,
      ...(m.del ? { deletedAt: m.del.at, deletedBy: name(m.del.by) } : {})
    }));
  const fire: ReportFire[] = s.log.slice(-REPORT_LIMITS.fire).map(({ entry: e }) => ({
    id: e.id,
    at: num(e.at),
    by: name(e.by),
    mortar: str(e.mortarName, 40),
    target: str(e.targetName, 40),
    weapon: str(e.weapon, 12),
    shell: str(e.shell, 40),
    charge: num(e.charge),
    elevation: num(e.elevation),
    bearingMils: num(e.bearingMils),
    range: num(e.range),
    warnings: Array.isArray(e.warnings) ? e.warnings.length : 0
  }));
  return { schema: REPORT_SCHEMA, title: "", notes: "", terrain: s.terrain, startedAt: s.createdAt, endedAt: now, members, marks, fire };
}

/** Перевіряє й застосовує правку (чиста функція: нова копія або null, якщо правка недійсна). */
export function applyReportEdit(r: Report, e: ReportEdit): Report | null {
  switch (e.k) {
    case "title":
      return e.value.length <= REPORT_LIMITS.title ? { ...r, title: clean(e.value) } : null;
    case "notes":
      return e.value.length <= REPORT_LIMITS.notes ? { ...r, notes: e.value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim() } : null;
    case "mark": {
      const i = r.marks.findIndex((m) => m.id === e.id);
      if (i < 0) return null;
      const m = { ...r.marks[i] };
      if (e.name !== undefined) {
        if (e.name.length > LIMITS.markName) return null;
        m.name = clean(e.name);
      }
      if (e.caption !== undefined) {
        if (e.caption.length > LIMITS.caption) return null;
        m.caption = clean(e.caption);
      }
      if (e.destroyed !== undefined) m.destroyed = e.destroyed;
      if (e.excluded !== undefined) {
        if (e.excluded) m.excluded = true;
        else delete m.excluded;
      }
      const marks = r.marks.slice();
      marks[i] = m;
      return { ...r, marks };
    }
  }
}

function clean(v: string): string {
  return v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

/** Читає правку з сирого об'єкта (повідомлення клієнта). */
export function readReportEdit(raw: unknown): ReportEdit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.k === "title" || o.k === "notes") return typeof o.value === "string" ? ({ k: o.k, value: o.value } as ReportEdit) : null;
  if (o.k === "mark" && typeof o.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(o.id)) {
    const e: Extract<ReportEdit, { k: "mark" }> = { k: "mark", id: o.id };
    if (o.name !== undefined) {
      if (typeof o.name !== "string") return null;
      e.name = o.name;
    }
    if (o.caption !== undefined) {
      if (typeof o.caption !== "string") return null;
      e.caption = o.caption;
    }
    if (o.destroyed !== undefined) {
      if (typeof o.destroyed !== "boolean") return null;
      e.destroyed = o.destroyed;
    }
    if (o.excluded !== undefined) {
      if (typeof o.excluded !== "boolean") return null;
      e.excluded = o.excluded;
    }
    return e.name === undefined && e.caption === undefined && e.destroyed === undefined && e.excluded === undefined ? null : e;
  }
  return null;
}

// ---------- підсумки ----------

export interface MemberStats {
  callsign: string;
  role: Role;
  removed: boolean;
  created: number;
  friend: number;
  hostile: number;
  destroyed: number;
  fireMissions: number;
}

export interface ReportStats {
  /** Живі мітки, що не виключені. */
  total: number;
  friend: number;
  hostile: number;
  byKind: Record<Affiliation, Record<SquadKind, number>>;
  destroyed: number;
  deleted: number;
  fireMissions: number;
  warnings: number;
  members: MemberStats[];
}

const zeroKinds = (): Record<SquadKind, number> => ({ infantry: 0, armour: 0, mortar: 0, helicopter: 0, retreat: 0 });

export function reportStats(r: Report): ReportStats {
  const byKind = { friend: zeroKinds(), hostile: zeroKinds() };
  const members = new Map<string, MemberStats>(
    r.members.map((m) => [m.callsign, { callsign: m.callsign, role: m.role, removed: m.removed, created: 0, friend: 0, hostile: 0, destroyed: 0, fireMissions: 0 }])
  );
  const of = (callsign: string): MemberStats => {
    let m = members.get(callsign);
    if (!m) {
      m = { callsign, role: "soldier", removed: true, created: 0, friend: 0, hostile: 0, destroyed: 0, fireMissions: 0 };
      members.set(callsign, m);
    }
    return m;
  };
  let total = 0;
  let destroyed = 0;
  let deleted = 0;
  for (const m of r.marks) {
    if (m.excluded) continue;
    if (m.deletedAt) {
      deleted++;
      continue;
    }
    total++;
    byKind[m.aff][m.kind]++;
    if (m.destroyed) destroyed++;
    const s = of(m.by);
    s.created++;
    s[m.aff]++;
    if (m.destroyed) s.destroyed++;
  }
  let warnings = 0;
  for (const f of r.fire) {
    of(f.by).fireMissions++;
    warnings += f.warnings;
  }
  return {
    total,
    friend: Object.values(byKind.friend).reduce((a, b) => a + b, 0),
    hostile: Object.values(byKind.hostile).reduce((a, b) => a + b, 0),
    byKind,
    destroyed,
    deleted,
    fireMissions: r.fire.length,
    warnings,
    members: [...members.values()]
  };
}

export type TimelineEvent =
  | { at: number; who: string; type: "joined" }
  | { at: number; who: string; type: "mark"; mark: ReportMark }
  | { at: number; who: string; type: "updated"; mark: ReportMark }
  | { at: number; who: string; type: "deleted"; mark: ReportMark }
  | { at: number; who: string; type: "fire"; fire: ReportFire };

/** Хронологія подій: хто приєднався, що позначив, змінив, видалив і яку стрільбу записав. */
export function reportTimeline(r: Report): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const m of r.members) out.push({ at: m.joinedAt, who: m.callsign, type: "joined" });
  for (const m of r.marks) {
    if (m.excluded) continue;
    out.push({ at: m.at, who: m.by, type: "mark", mark: m });
    if (m.ut > m.at && !m.deletedAt) out.push({ at: m.ut, who: m.ub, type: "updated", mark: m });
    if (m.deletedAt) out.push({ at: m.deletedAt, who: m.deletedBy ?? "?", type: "deleted", mark: m });
  }
  for (const f of r.fire) out.push({ at: f.at, who: f.by, type: "fire", fire: f });
  return out.sort((a, b) => a.at - b.at);
}

// ---------- читання з файлу ----------

/** Перевіряє звіт, прочитаний із файлу: невідома схема або зламані поля відкидаються. */
export function readReport(raw: unknown): Report | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schema !== REPORT_SCHEMA || !Array.isArray(o.members) || !Array.isArray(o.marks) || !Array.isArray(o.fire)) return null;
  const kinds: SquadKind[] = ["infantry", "armour", "mortar", "helicopter", "retreat"];
  const roles: Role[] = ["commander", "mortarman", "soldier"];
  const members: ReportMember[] = [];
  for (const m of o.members.slice(0, 100) as Record<string, unknown>[]) {
    if (!m || typeof m !== "object") continue;
    members.push({ id: str(m.id, 64), callsign: str(m.callsign, 16), role: roles.includes(m.role as Role) ? (m.role as Role) : "soldier", removed: m.removed === true, joinedAt: num(m.joinedAt) });
  }
  const marks: ReportMark[] = [];
  for (const m of o.marks.slice(0, 500) as Record<string, unknown>[]) {
    if (!m || typeof m !== "object" || (m.aff !== "friend" && m.aff !== "hostile") || !kinds.includes(m.kind as SquadKind)) continue;
    marks.push({
      id: str(m.id, 64),
      aff: m.aff,
      kind: m.kind as SquadKind,
      name: str(m.name, LIMITS.markName),
      caption: str(m.caption, LIMITS.caption),
      x: num(m.x),
      z: num(m.z),
      h: typeof m.h === "number" && isFinite(m.h) ? m.h : null,
      w: str(m.w, 12),
      destroyed: m.destroyed === true,
      by: str(m.by, 16),
      at: num(m.at),
      ub: str(m.ub, 16),
      ut: num(m.ut),
      ...(typeof m.deletedAt === "number" ? { deletedAt: m.deletedAt, deletedBy: str(m.deletedBy, 16) } : {}),
      ...(m.excluded === true ? { excluded: true } : {})
    });
  }
  const fire: ReportFire[] = [];
  for (const f of o.fire.slice(0, 500) as Record<string, unknown>[]) {
    if (!f || typeof f !== "object") continue;
    fire.push({
      id: str(f.id, 64),
      at: num(f.at),
      by: str(f.by, 16),
      mortar: str(f.mortar, 40),
      target: str(f.target, 40),
      weapon: str(f.weapon, 12),
      shell: str(f.shell, 40),
      charge: num(f.charge),
      elevation: num(f.elevation),
      bearingMils: num(f.bearingMils),
      range: num(f.range),
      warnings: num(f.warnings)
    });
  }
  return {
    schema: REPORT_SCHEMA,
    title: str(o.title, REPORT_LIMITS.title),
    notes: str(o.notes, REPORT_LIMITS.notes),
    terrain: str(o.terrain, 64),
    startedAt: num(o.startedAt),
    endedAt: num(o.endedAt),
    members,
    marks,
    fire
  };
}
