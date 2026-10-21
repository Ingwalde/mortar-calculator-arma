/**
 * Кімната відділення: уся логіка реле без прив'язки до хостингу (docs/squad-mode.md, розділи 4, 8, 9, 11).
 * Кімната не знає ні про сокети, ні про сховище: вона приймає розібрані повідомлення й повертає ефекти (кому що надіслати,
 * кого відключити), а зміни стану віддає списком записів для сховища. Хешування й випадкові значення робить обгортка
 * (Durable Object) — тут усе детерміноване й перевіряється звичайними тестами.
 */
import { LIMITS, PROTOCOL_VERSION, callsignKey, readCallsign } from "./protocol";
import type { AdminAction, ClientMsg, ErrorCode, FireEntry, MarkOp, MemberInfo, RejectReason, Role, ServerMsg, SquadMark } from "./protocol";
import { canAdmin, canCaption, canCreate, canDelete, canEdit, canMove, canSetStatus, canUseSolution } from "./permissions";

export const IDLE_MS = 3 * 24 * 3600 * 1000;
export const ENDED_MS = 24 * 3600 * 1000;
const OPS_WINDOW_MS = 60_000;
const OP_MEMORY = 1000;
const ACTIVITY_WRITE_MS = 3_600_000;

export interface Member {
  id: string;
  callsign: string;
  role: Role;
  keyHash: string;
  removed: boolean;
  editor: boolean;
  joinedAt: number;
}

export type StoredMark = SquadMark & { del?: { by: string; at: number } };

export interface SquadState {
  v: 1;
  createdAt: number;
  lastActive: number;
  joinHash: string;
  /** Карта відділення (id терену); порожній рядок, поки не вибрано. */
  terrain: string;
  phase: "active" | "ended";
  endedAt: number | null;
  seq: number;
  members: Record<string, Member>;
  marks: Record<string, StoredMark>;
  log: { s: number; entry: FireEntry }[];
}

export type Audience = { kind: "all" } | { kind: "roles"; roles: Role[] } | { kind: "member"; id: string };

export type Effect =
  | { k: "send"; aud: Audience; msg: ServerMsg }
  /** Закрити з'єднання учасника (вилучено, кімнату видалено). */
  | { k: "close"; member: string; code: ErrorCode }
  /** Стерти все про відділення й закрити всіх. */
  | { k: "wipe" };

export interface Changes {
  puts: Record<string, unknown>;
  deletes: string[];
}

export interface HelloInput {
  joinHash: string;
  callsign: string;
  /** Хеш ключа, який прислав пристрій (якщо вже був у відділенні). */
  keyHash: string | null;
  /** Заготовлені обгорткою значення для нового учасника. */
  newMemberId: string;
  newKeyHash: string;
  now: number;
}

export type HelloResult =
  | { ok: true; memberId: string; isNew: boolean; effects: Effect[] }
  | { ok: false; code: ErrorCode };

const metaKey = "meta";
const memberKey = (id: string): string => `m:${id}`;
const markKey = (id: string): string => `k:${id}`;
const logKey = (id: string): string => `l:${id}`;

const send = (aud: Audience, msg: ServerMsg): Effect => ({ k: "send", aud, msg });
const toMember = (id: string, msg: ServerMsg): Effect => send({ kind: "member", id }, msg);
const reject = (id: string, opId: string, reason: RejectReason): Effect[] => [toMember(id, { t: "reject", v: PROTOCOL_VERSION, opId, reason })];

export class Room {
  readonly state: SquadState;
  private online = new Map<string, number>();
  private keyIndex = new Map<string, string>();
  private dirty = new Set<string>();
  private gone = new Set<string>();
  private seen = new Map<string, number>();
  private hits = new Map<string, number[]>();
  private persistedActive: number;

  private constructor(state: SquadState) {
    this.state = state;
    this.persistedActive = state.lastActive;
    for (const m of Object.values(state.members)) this.keyIndex.set(m.keyHash, m.id);
  }

  /** Нова кімната: її створювач — командир. */
  static create(i: { joinHash: string; memberId: string; callsign: string; keyHash: string; now: number; terrain?: string }): Room {
    const callsign = readCallsign(i.callsign);
    if (!callsign) throw new Error("bad callsign");
    const state: SquadState = {
      v: 1,
      createdAt: i.now,
      lastActive: i.now,
      joinHash: i.joinHash,
      terrain: i.terrain ?? "",
      phase: "active",
      endedAt: null,
      seq: 0,
      members: { [i.memberId]: { id: i.memberId, callsign, role: "commander", keyHash: i.keyHash, removed: false, editor: false, joinedAt: i.now } },
      marks: {},
      log: []
    };
    const room = new Room(state);
    room.dirty.add(metaKey).add(memberKey(i.memberId));
    return room;
  }

  /** Відновлення зі сховища (записи, які віддав `takeChanges`). Повертає null, якщо запису кімнати немає. */
  static restore(entries: Record<string, unknown>): Room | null {
    const meta = entries[metaKey] as Omit<SquadState, "members" | "marks" | "log"> | undefined;
    if (!meta || meta.v !== 1) return null;
    const state: SquadState = { ...meta, members: {}, marks: {}, log: [] };
    for (const [k, v] of Object.entries(entries)) {
      if (k.startsWith("m:")) state.members[(v as Member).id] = v as Member;
      else if (k.startsWith("k:")) state.marks[(v as StoredMark).id] = v as StoredMark;
      else if (k.startsWith("l:")) state.log.push(v as { s: number; entry: FireEntry });
    }
    state.log.sort((a, b) => a.s - b.s);
    return new Room(state);
  }

  takeChanges(): Changes {
    const puts: Record<string, unknown> = {};
    for (const k of this.dirty) {
      if (k === metaKey) {
        const { members: _m, marks: _k, log: _l, ...meta } = this.state;
        puts[k] = meta;
      } else if (k.startsWith("m:")) puts[k] = this.state.members[k.slice(2)];
      else if (k.startsWith("k:")) puts[k] = this.state.marks[k.slice(2)];
      else if (k.startsWith("l:")) puts[k] = this.state.log.find((e) => e.entry.id === k.slice(2));
    }
    const deletes = [...this.gone];
    this.dirty.clear();
    this.gone.clear();
    return { puts, deletes };
  }

  // ---------- час життя ----------

  /** Коли обгортка має розбудити кімнату, щоб видалити її (мс від епохи). */
  alarmAt(): number {
    return this.state.phase === "ended" && this.state.endedAt !== null ? this.state.endedAt + ENDED_MS : this.state.lastActive + IDLE_MS;
  }

  onAlarm(now: number): "delete" | "keep" {
    return now >= this.alarmAt() ? "delete" : "keep";
  }

  // ---------- запити для обгортки ----------

  roleOf(id: string): Role | null {
    const m = this.state.members[id];
    return m && !m.removed ? m.role : null;
  }

  /** Чи належить учасник до аудиторії ефекту (вилучені не належать ніколи). */
  accepts(aud: Audience, id: string): boolean {
    const m = this.state.members[id];
    if (!m || m.removed) return false;
    return aud.kind === "all" || (aud.kind === "member" && aud.id === id) || (aud.kind === "roles" && aud.roles.includes(m.role));
  }

  // ---------- з'єднання ----------

  hello(i: HelloInput): HelloResult {
    const s = this.state;
    const existingId = i.keyHash ? this.keyIndex.get(i.keyHash) : undefined;
    if (existingId) {
      const m = s.members[existingId];
      if (m.removed) return { ok: false, code: "removed" };
      this.touch(i.now);
      return { ok: true, memberId: m.id, isNew: false, effects: [toMember(m.id, this.snapshot(m.id))] };
    }
    if (i.joinHash !== s.joinHash) return { ok: false, code: "bad_code" };
    if (s.phase === "ended") return { ok: false, code: "ended" };
    const callsign = readCallsign(i.callsign);
    if (!callsign) return { ok: false, code: "bad_callsign" };
    const key = callsignKey(callsign);
    if (Object.values(s.members).some((m) => callsignKey(m.callsign) === key)) return { ok: false, code: "callsign_taken" };
    const active = Object.values(s.members).filter((m) => !m.removed).length;
    if (active >= LIMITS.members) return { ok: false, code: "full" };
    s.members[i.newMemberId] = { id: i.newMemberId, callsign, role: "soldier", keyHash: i.newKeyHash, removed: false, editor: false, joinedAt: i.now };
    this.keyIndex.set(i.newKeyHash, i.newMemberId);
    this.dirty.add(memberKey(i.newMemberId));
    this.touch(i.now, true);
    return { ok: true, memberId: i.newMemberId, isNew: true, effects: [toMember(i.newMemberId, this.snapshot(i.newMemberId)), ...this.membersEffects()] };
  }

  connected(id: string): Effect[] {
    const n = (this.online.get(id) ?? 0) + 1;
    this.online.set(id, n);
    return n === 1 ? this.membersEffects() : [];
  }

  disconnected(id: string): Effect[] {
    const n = (this.online.get(id) ?? 0) - 1;
    if (n > 0) {
      this.online.set(id, n);
      return [];
    }
    this.online.delete(id);
    return this.state.members[id]?.removed ? [] : this.membersEffects();
  }

  // ---------- повідомлення ----------

  handle(id: string, msg: ClientMsg, now: number): Effect[] {
    const m = this.state.members[id];
    if (!m || m.removed) return [{ k: "close", member: id, code: "removed" }];
    if (msg.t === "ping" || msg.t === "hello") return [];
    if (this.seen.has(msg.opId)) return [toMember(id, { t: "ack", v: PROTOCOL_VERSION, opId: msg.opId, seq: this.seen.get(msg.opId)! })];
    if (!this.allow(id, now)) return reject(id, msg.opId, "rate");
    if (msg.t === "op") return this.markOp(m, msg.opId, msg.op, now);
    if (msg.t === "log") return this.logEntry(m, msg.opId, msg.entry, now);
    return this.admin(m, msg.opId, msg.action, now);
  }

  /** Нова таємниця для приєднання (хеш рахує обгортка). Лише командир. */
  rotateJoin(id: string, newJoinHash: string, now: number): boolean {
    const m = this.state.members[id];
    if (!m || m.removed || !canAdmin(m.role) || this.state.phase !== "active") return false;
    this.state.joinHash = newJoinHash;
    this.touch(now, true);
    return true;
  }

  // ---------- мітки ----------

  private markOp(m: Member, opId: string, op: MarkOp, now: number): Effect[] {
    const s = this.state;
    if (s.phase === "ended") return reject(m.id, opId, "ended");
    const cur = s.marks[op.id];
    if (op.k === "create") {
      if (cur) return cur.del ? reject(m.id, opId, "deleted") : cur.by === m.id ? this.ack(m.id, opId) : reject(m.id, opId, "exists");
      if (!canCreate(m.role, op.aff, op.kind)) return reject(m.id, opId, "permission");
      if (this.liveMarks() >= LIMITS.marks) return reject(m.id, opId, "limit");
      const mark: StoredMark = { id: op.id, aff: op.aff, kind: op.kind, name: op.name, caption: op.caption, x: op.x, z: op.z, u: op.u, w: op.w, destroyed: false, by: m.id, at: now, ub: m.id, ut: now };
      s.marks[op.id] = mark;
      return this.accept(m, opId, op, mark, now);
    }
    if (!cur) return reject(m.id, opId, "unknown");
    if (cur.del) return reject(m.id, opId, "deleted");
    const ref = { aff: cur.aff, kind: cur.kind, own: cur.by === m.id };
    switch (op.k) {
      case "edit": {
        if (!canEdit(m.role, ref)) return reject(m.id, opId, "permission");
        const aff = op.aff ?? cur.aff;
        const kind = op.kind ?? cur.kind;
        if ((aff !== cur.aff || kind !== cur.kind) && !canCreate(m.role, aff, kind)) return reject(m.id, opId, "permission");
        cur.aff = aff;
        cur.kind = kind;
        if (op.name !== undefined) cur.name = op.name;
        if (op.w !== undefined) cur.w = op.w;
        // свій міномет не буває «зруйнованим»
        if (aff === "friend" && kind === "mortar") cur.destroyed = false;
        break;
      }
      case "move":
        if (!canMove(m.role)) return reject(m.id, opId, "permission");
        cur.x = op.x;
        cur.z = op.z;
        cur.u = op.u;
        break;
      case "caption":
        if (!canCaption(m.role, ref)) return reject(m.id, opId, "permission");
        cur.caption = op.caption;
        break;
      case "status":
        if (!canSetStatus(m.role)) return reject(m.id, opId, "permission");
        if (cur.aff === "friend" && cur.kind === "mortar") return reject(m.id, opId, "invalid");
        cur.destroyed = op.destroyed;
        break;
      case "delete":
        if (!canDelete(m.role, ref)) return reject(m.id, opId, "permission");
        cur.del = { by: m.id, at: now };
        this.trimTombstones();
        break;
    }
    cur.ub = m.id;
    cur.ut = now;
    return this.accept(m, opId, op, cur, now);
  }

  private accept(m: Member, opId: string, op: MarkOp, mark: StoredMark, now: number): Effect[] {
    const s = this.state;
    s.seq++;
    this.remember(opId);
    this.dirty.add(markKey(mark.id));
    this.touch(now, true);
    const { del: _del, ...pub } = mark;
    return [send({ kind: "all" }, { t: "op", v: PROTOCOL_VERSION, seq: s.seq, opId, by: m.id, at: now, op, mark: mark.del ? null : pub })];
  }

  private ack(id: string, opId: string): Effect[] {
    return [toMember(id, { t: "ack", v: PROTOCOL_VERSION, opId, seq: this.state.seq })];
  }

  private liveMarks(): number {
    return Object.values(this.state.marks).filter((k) => !k.del).length;
  }

  private trimTombstones(): void {
    const dead = Object.values(this.state.marks).filter((k) => k.del);
    if (dead.length <= LIMITS.tombstones) return;
    dead.sort((a, b) => a.del!.at - b.del!.at);
    for (const k of dead.slice(0, dead.length - LIMITS.tombstones)) {
      delete this.state.marks[k.id];
      this.dirty.delete(markKey(k.id));
      this.gone.add(markKey(k.id));
    }
  }

  // ---------- журнал стрільби ----------

  private logEntry(m: Member, opId: string, entry: FireEntry, now: number): Effect[] {
    const s = this.state;
    if (!canUseSolution(m.role)) return reject(m.id, opId, "permission");
    if (s.phase === "ended") return reject(m.id, opId, "ended");
    if (s.log.some((e) => e.entry.id === entry.id)) return this.ack(m.id, opId);
    s.seq++;
    const stored: FireEntry = { ...entry, by: m.id };
    s.log.push({ s: s.seq, entry: stored });
    this.dirty.add(logKey(stored.id));
    while (s.log.length > LIMITS.logEntries) {
      const old = s.log.shift()!;
      this.dirty.delete(logKey(old.entry.id));
      this.gone.add(logKey(old.entry.id));
    }
    this.remember(opId);
    this.touch(now, true);
    return [send({ kind: "roles", roles: ["commander", "mortarman"] }, { t: "log", v: PROTOCOL_VERSION, seq: s.seq, entry: stored })];
  }

  // ---------- керування командира ----------

  private admin(m: Member, opId: string, a: AdminAction, now: number): Effect[] {
    const s = this.state;
    if (!canAdmin(m.role)) return reject(m.id, opId, "permission");
    if (s.phase === "ended" && a.a !== "delete" && a.a !== "editor") return reject(m.id, opId, "ended");
    this.remember(opId);
    switch (a.a) {
      case "delete":
        return [{ k: "wipe" }];
      case "end": {
        s.phase = "ended";
        s.endedAt = now;
        s.seq++;
        this.touch(now, true);
        return [send({ kind: "all" }, { t: "ended", v: PROTOCOL_VERSION, at: now })];
      }
      case "terrain": {
        s.terrain = a.id;
        s.seq++;
        this.touch(now, true);
        return [send({ kind: "all" }, { t: "terrain", v: PROTOCOL_VERSION, id: a.id })];
      }
      case "rotate":
        // код змінює обгортка через `rotateJoin` (вона знає, як хешувати); сюди така дія не доходить
        return reject(m.id, opId, "invalid");
      default:
        break;
    }
    const t = s.members[a.member];
    if (!t) return reject(m.id, opId, "unknown");
    const out: Effect[] = [];
    switch (a.a) {
      case "role": {
        if (t.removed) return reject(m.id, opId, "invalid");
        if (t.id === m.id) return reject(m.id, opId, "invalid");
        if (a.role === "commander") {
          t.role = "commander";
          m.role = "mortarman";
          this.dirty.add(memberKey(m.id));
          out.push(toMember(m.id, this.snapshot(m.id)));
        } else {
          t.role = a.role;
        }
        this.dirty.add(memberKey(t.id));
        out.push(toMember(t.id, this.snapshot(t.id)));
        break;
      }
      case "editor":
        if (t.removed) return reject(m.id, opId, "invalid");
        t.editor = a.allowed;
        this.dirty.add(memberKey(t.id));
        out.push(toMember(t.id, this.snapshot(t.id)));
        break;
      case "remove": {
        if (t.id === m.id || t.role === "commander" || t.removed) return reject(m.id, opId, t.removed ? "invalid" : "permission");
        if (Object.values(s.members).filter((x) => x.removed).length >= LIMITS.removedMembers) return reject(m.id, opId, "limit");
        t.removed = true;
        this.online.delete(t.id);
        this.dirty.add(memberKey(t.id));
        out.push({ k: "close", member: t.id, code: "removed" });
        break;
      }
      case "restore": {
        if (!t.removed) return reject(m.id, opId, "invalid");
        if (Object.values(s.members).filter((x) => !x.removed).length >= LIMITS.members) return reject(m.id, opId, "limit");
        t.removed = false;
        this.dirty.add(memberKey(t.id));
        break;
      }
    }
    this.touch(now, true);
    out.push(...this.membersEffects());
    return out;
  }

  // ---------- допоміжне ----------

  private snapshot(id: string): ServerMsg {
    const s = this.state;
    const m = s.members[id];
    const marks = Object.values(s.marks)
      .filter((k) => !k.del)
      .map(({ del: _d, ...k }) => k);
    return {
      t: "snapshot",
      v: PROTOCOL_VERSION,
      seq: s.seq,
      phase: s.phase,
      terrain: s.terrain,
      you: { id: m.id, role: m.role, callsign: m.callsign, editor: m.editor },
      marks,
      members: this.memberList(m.role === "commander"),
      log: canUseSolution(m.role) ? s.log.map((e) => e.entry) : null
    };
  }

  private memberList(withRemoved: boolean): MemberInfo[] {
    return Object.values(this.state.members)
      .filter((m) => withRemoved || !m.removed)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((m) => ({ id: m.id, callsign: m.callsign, role: m.role, editor: m.editor, online: this.online.has(m.id), removed: m.removed }));
  }

  /** Список учасників: командир бачить і вилучених (для відновлення), решта — лише чинних. */
  private membersEffects(): Effect[] {
    return [
      send({ kind: "roles", roles: ["commander"] }, { t: "members", v: PROTOCOL_VERSION, members: this.memberList(true) }),
      send({ kind: "roles", roles: ["mortarman", "soldier"] }, { t: "members", v: PROTOCOL_VERSION, members: this.memberList(false) })
    ];
  }

  private allow(id: string, now: number): boolean {
    const list = (this.hits.get(id) ?? []).filter((t) => now - t < OPS_WINDOW_MS);
    if (list.length >= LIMITS.opsPerMinute) {
      this.hits.set(id, list);
      return false;
    }
    list.push(now);
    this.hits.set(id, list);
    return true;
  }

  private remember(opId: string): void {
    this.seen.set(opId, this.state.seq);
    if (this.seen.size > OP_MEMORY) this.seen.delete(this.seen.keys().next().value as string);
  }

  private touch(now: number, force = false): void {
    const s = this.state;
    s.lastActive = Math.max(s.lastActive, now);
    if (force || now - this.persistedActive >= ACTIVITY_WRITE_MS) {
      this.dirty.add(metaKey);
      this.persistedActive = s.lastActive;
    }
  }
}
