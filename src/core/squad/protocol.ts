/**
 * Протокол режиму відділення (docs/squad-mode.md, розділ 8): типи повідомлень, ліміти й перевірка того, що надіслав клієнт.
 * Чистий TypeScript без DOM і без залежностей від хостингу: його використовують і клієнт, і реле-сервер, і тести.
 */
import { CAPTION_MAX, isAffiliation, type Affiliation, type MarkKind } from "../marks";
import { readReportEdit, type Report, type ReportEdit } from "./report";

export const PROTOCOL_VERSION = 1;

export const LIMITS = {
  members: 20,
  marks: 100,
  opsPerMinute: 40,
  messageBytes: 8192,
  caption: CAPTION_MAX,
  markName: 40,
  logEntries: 200,
  tombstones: 300,
  removedMembers: 40,
  callsignMin: 2,
  callsignMax: 16,
  coord: 100000
} as const;

export type Role = "commander" | "mortarman" | "soldier";
export const ROLES: readonly Role[] = ["commander", "mortarman", "soldier"];

/** Види, які можна створити в відділенні (стара довільна точка `legacy` на сервер не потрапляє). */
export type SquadKind = Exclude<MarkKind, "legacy">;
export const SQUAD_KINDS: readonly SquadKind[] = ["infantry", "armour", "mortar", "helicopter", "retreat"];

export type RejectReason = "permission" | "deleted" | "unknown" | "exists" | "limit" | "rate" | "invalid" | "ended";
export type ErrorCode = "bad_code" | "bad_callsign" | "callsign_taken" | "full" | "removed" | "ended" | "version" | "invalid" | "gone";

/** Мітка на сервері: те, що бачать усі учасники. */
export interface SquadMark {
  id: string;
  aff: Affiliation;
  kind: SquadKind;
  name: string;
  caption: string;
  x: number;
  z: number;
  /** Висота над рівнем моря, якщо відома. */
  u: number | null;
  /** Гармата міномета (M252, 2B14); порожній рядок, якщо не міномет. */
  w: string;
  destroyed: boolean;
  /** Автор (id учасника) і час створення. */
  by: string;
  at: number;
  /** Хто й коли змінив востаннє. */
  ub: string;
  ut: number;
}

export interface FireEntry {
  id: string;
  at: number;
  /** Хто записав (id учасника) — ставить сервер. */
  by?: string;
  [field: string]: unknown;
}

export type MarkOp =
  | { k: "create"; id: string; aff: Affiliation; kind: SquadKind; x: number; z: number; name: string; caption: string; u: number | null; w: string }
  | { k: "edit"; id: string; aff?: Affiliation; kind?: SquadKind; name?: string; w?: string }
  | { k: "move"; id: string; x: number; z: number; u: number | null }
  | { k: "caption"; id: string; caption: string }
  | { k: "status"; id: string; destroyed: boolean }
  | { k: "delete"; id: string };

export type AdminAction =
  | { a: "role"; member: string; role: Role }
  | { a: "remove"; member: string }
  | { a: "restore"; member: string }
  | { a: "editor"; member: string; allowed: boolean }
  | { a: "terrain"; id: string }
  | { a: "rotate" }
  | { a: "end" }
  | { a: "delete" };

export type ClientMsg =
  | { t: "hello"; v: number; code: string; callsign: string; key?: string }
  | { t: "op"; v: number; opId: string; op: MarkOp }
  | { t: "log"; v: number; opId: string; entry: FireEntry }
  | { t: "admin"; v: number; opId: string; action: AdminAction }
  | { t: "report"; v: number; opId: string; edit: ReportEdit }
  | { t: "exported"; v: number; opId: string }
  | { t: "sync"; v: number }
  | { t: "ping"; v: number };

export interface MemberInfo {
  id: string;
  callsign: string;
  role: Role;
  editor: boolean;
  online: boolean;
  removed: boolean;
}

export type ServerMsg =
  | { t: "welcome"; v: number; memberId: string; key?: string }
  | {
      t: "snapshot";
      v: number;
      seq: number;
      phase: "active" | "ended";
      /** Карта відділення: усі мітки мають координати на ній. */
      terrain: string;
      you: { id: string; role: Role; callsign: string; editor: boolean };
      marks: SquadMark[];
      members: MemberInfo[];
      log: FireEntry[] | null;
      /** Звіт, якщо гру закінчено. */
      report: Report | null;
    }
  | { t: "op"; v: number; seq: number; opId: string; by: string; at: number; op: MarkOp; mark: SquadMark | null }
  | { t: "ack"; v: number; opId: string; seq: number }
  | { t: "reject"; v: number; opId: string; reason: RejectReason }
  | { t: "members"; v: number; members: MemberInfo[] }
  | { t: "log"; v: number; seq: number; entry: FireEntry }
  | { t: "terrain"; v: number; id: string }
  | { t: "ended"; v: number; at: number; report: Report }
  | { t: "reportEdit"; v: number; by: string; edit: ReportEdit }
  | { t: "code"; v: number; code: string }
  | { t: "error"; v: number; code: ErrorCode };

export type ParseResult = { ok: true; msg: ClientMsg } | { ok: false; code: "invalid" | "version" };

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function isId(v: unknown): v is string {
  return typeof v === "string" && ID_RE.test(v);
}

function isCoord(v: unknown): v is number {
  return typeof v === "number" && isFinite(v) && Math.abs(v) <= LIMITS.coord;
}

function isHeight(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && isFinite(v) && Math.abs(v) <= 10000);
}

/** Текст без керівних символів і з пробілами по краях обрізаними; null — якщо не рядок або задовгий. */
export function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string" || v.length > max * 4) return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return s.length <= max ? s : null;
}

function isWeapon(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9]{0,12}$/.test(v);
}

function isSquadKind(v: unknown): v is SquadKind {
  return typeof v === "string" && (SQUAD_KINDS as readonly string[]).includes(v);
}

function parseOp(o: Record<string, unknown>): MarkOp | null {
  if (!isId(o.id)) return null;
  const id = o.id;
  switch (o.k) {
    case "create": {
      const name = cleanText(o.name ?? "", LIMITS.markName);
      const caption = cleanText(o.caption ?? "", LIMITS.caption);
      if (!isAffiliation(o.aff) || !isSquadKind(o.kind) || !isCoord(o.x) || !isCoord(o.z) || name === null || caption === null) return null;
      const u = o.u === undefined ? null : o.u;
      const w = o.w === undefined ? "" : o.w;
      if (!isHeight(u) || !isWeapon(w)) return null;
      return { k: "create", id, aff: o.aff, kind: o.kind, x: o.x, z: o.z, name, caption, u, w };
    }
    case "edit": {
      const op: MarkOp = { k: "edit", id };
      if (o.aff !== undefined) {
        if (!isAffiliation(o.aff)) return null;
        op.aff = o.aff;
      }
      if (o.kind !== undefined) {
        if (!isSquadKind(o.kind)) return null;
        op.kind = o.kind;
      }
      if (o.name !== undefined) {
        const name = cleanText(o.name, LIMITS.markName);
        if (name === null) return null;
        op.name = name;
      }
      if (o.w !== undefined) {
        if (!isWeapon(o.w)) return null;
        op.w = o.w;
      }
      return op.aff === undefined && op.kind === undefined && op.name === undefined && op.w === undefined ? null : op;
    }
    case "move": {
      const u = o.u === undefined ? null : o.u;
      if (!isCoord(o.x) || !isCoord(o.z) || !isHeight(u)) return null;
      return { k: "move", id, x: o.x, z: o.z, u };
    }
    case "caption": {
      const caption = cleanText(o.caption, LIMITS.caption);
      return caption === null ? null : { k: "caption", id, caption };
    }
    case "status":
      return typeof o.destroyed === "boolean" ? { k: "status", id, destroyed: o.destroyed } : null;
    case "delete":
      return { k: "delete", id };
    default:
      return null;
  }
}

function parseAdmin(o: Record<string, unknown>): AdminAction | null {
  switch (o.a) {
    case "role":
      return isId(o.member) && typeof o.role === "string" && (ROLES as readonly string[]).includes(o.role)
        ? { a: "role", member: o.member, role: o.role as Role }
        : null;
    case "remove":
    case "restore":
      return isId(o.member) ? { a: o.a, member: o.member } : null;
    case "editor":
      return isId(o.member) && typeof o.allowed === "boolean" ? { a: "editor", member: o.member, allowed: o.allowed } : null;
    case "terrain":
      return isId(o.id) ? { a: "terrain", id: o.id } : null;
    case "rotate":
    case "end":
    case "delete":
      return { a: o.a };
    default:
      return null;
  }
}

/** Розбирає й перевіряє рядок від клієнта. Усе, що не відповідає схемі, відкидається. */
export function parseClientMessage(raw: unknown): ParseResult {
  if (typeof raw !== "string" || raw.length > LIMITS.messageBytes) return { ok: false, code: "invalid" };
  // байтовий розмір: кирилиця в UTF-8 займає по 2 байти
  if (new TextEncoder().encode(raw).length > LIMITS.messageBytes) return { ok: false, code: "invalid" };
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return { ok: false, code: "invalid" };
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) return { ok: false, code: "invalid" };
  const o = j as Record<string, unknown>;
  if (o.v !== PROTOCOL_VERSION) return { ok: false, code: "version" };
  switch (o.t) {
    case "ping":
      return { ok: true, msg: { t: "ping", v: PROTOCOL_VERSION } };
    case "sync":
      return { ok: true, msg: { t: "sync", v: PROTOCOL_VERSION } };
    case "report": {
      const edit = readReportEdit(o.edit);
      return isId(o.opId) && edit ? { ok: true, msg: { t: "report", v: PROTOCOL_VERSION, opId: o.opId, edit } } : { ok: false, code: "invalid" };
    }
    case "exported":
      return isId(o.opId) ? { ok: true, msg: { t: "exported", v: PROTOCOL_VERSION, opId: o.opId } } : { ok: false, code: "invalid" };
    case "hello": {
      if (typeof o.code !== "string" || o.code.length > 128) return { ok: false, code: "invalid" };
      if (typeof o.callsign !== "string" || o.callsign.length > 64) return { ok: false, code: "invalid" };
      if (o.key !== undefined && (typeof o.key !== "string" || o.key.length > 128)) return { ok: false, code: "invalid" };
      return { ok: true, msg: { t: "hello", v: PROTOCOL_VERSION, code: o.code, callsign: o.callsign, ...(o.key ? { key: o.key } : {}) } };
    }
    case "op": {
      if (!isId(o.opId) || !o.op || typeof o.op !== "object") return { ok: false, code: "invalid" };
      const op = parseOp(o.op as Record<string, unknown>);
      return op ? { ok: true, msg: { t: "op", v: PROTOCOL_VERSION, opId: o.opId, op } } : { ok: false, code: "invalid" };
    }
    case "log": {
      if (!isId(o.opId) || !o.entry || typeof o.entry !== "object" || Array.isArray(o.entry)) return { ok: false, code: "invalid" };
      const e = o.entry as Record<string, unknown>;
      if (!isId(e.id) || typeof e.at !== "number" || !isFinite(e.at)) return { ok: false, code: "invalid" };
      // сервер не тлумачить поля запису, лише обмежує розмір (загальний ліміт повідомлення вже перевірено)
      return { ok: true, msg: { t: "log", v: PROTOCOL_VERSION, opId: o.opId, entry: { ...e, id: e.id, at: e.at } as FireEntry } };
    }
    case "admin": {
      if (!isId(o.opId) || !o.action || typeof o.action !== "object") return { ok: false, code: "invalid" };
      const action = parseAdmin(o.action as Record<string, unknown>);
      return action ? { ok: true, msg: { t: "admin", v: PROTOCOL_VERSION, opId: o.opId, action } } : { ok: false, code: "invalid" };
    }
    default:
      return { ok: false, code: "invalid" };
  }
}

/** Позивний: 2–16 символів (літери, цифри, `-`, `_`, пробіл), без пробілів по краях. Повертає очищений або null. */
export function readCallsign(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  if (s.length < LIMITS.callsignMin || s.length > LIMITS.callsignMax) return null;
  return /^[\p{L}\p{N}_\- ]+$/u.test(s) ? s : null;
}

/** Ключ для перевірки унікальності: регістр, пробіли, `-` і `_` не відрізняють позивні («Alpha-2» = «alpha 2» = «ALPHA2»). */
export function callsignKey(callsign: string): string {
  return callsign.toLowerCase().replace(/[\s_-]+/g, "");
}
