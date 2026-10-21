var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { DurableObject } from "cloudflare:workers";

// ../src/core/marks.ts
var CAPTION_MAX = 120;
function isAffiliation(v) {
  return v === "friend" || v === "hostile";
}
__name(isAffiliation, "isAffiliation");

// ../src/core/squad/protocol.ts
var PROTOCOL_VERSION = 1;
var LIMITS = {
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
  coord: 1e5
};
var ROLES = ["commander", "mortarman", "soldier"];
var SQUAD_KINDS = ["infantry", "armour", "mortar", "helicopter", "retreat"];
var ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
function isId(v) {
  return typeof v === "string" && ID_RE.test(v);
}
__name(isId, "isId");
function isCoord(v) {
  return typeof v === "number" && isFinite(v) && Math.abs(v) <= LIMITS.coord;
}
__name(isCoord, "isCoord");
function isHeight(v) {
  return v === null || typeof v === "number" && isFinite(v) && Math.abs(v) <= 1e4;
}
__name(isHeight, "isHeight");
function cleanText(v, max) {
  if (typeof v !== "string" || v.length > max * 4) return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return s.length <= max ? s : null;
}
__name(cleanText, "cleanText");
function isSquadKind(v) {
  return typeof v === "string" && SQUAD_KINDS.includes(v);
}
__name(isSquadKind, "isSquadKind");
function parseOp(o) {
  if (!isId(o.id)) return null;
  const id = o.id;
  switch (o.k) {
    case "create": {
      const name = cleanText(o.name ?? "", LIMITS.markName);
      const caption = cleanText(o.caption ?? "", LIMITS.caption);
      if (!isAffiliation(o.aff) || !isSquadKind(o.kind) || !isCoord(o.x) || !isCoord(o.z) || name === null || caption === null) return null;
      const u = o.u === void 0 ? null : o.u;
      if (!isHeight(u)) return null;
      return { k: "create", id, aff: o.aff, kind: o.kind, x: o.x, z: o.z, name, caption, u };
    }
    case "edit": {
      const op = { k: "edit", id };
      if (o.aff !== void 0) {
        if (!isAffiliation(o.aff)) return null;
        op.aff = o.aff;
      }
      if (o.kind !== void 0) {
        if (!isSquadKind(o.kind)) return null;
        op.kind = o.kind;
      }
      if (o.name !== void 0) {
        const name = cleanText(o.name, LIMITS.markName);
        if (name === null) return null;
        op.name = name;
      }
      return op.aff === void 0 && op.kind === void 0 && op.name === void 0 ? null : op;
    }
    case "move": {
      const u = o.u === void 0 ? null : o.u;
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
__name(parseOp, "parseOp");
function parseAdmin(o) {
  switch (o.a) {
    case "role":
      return isId(o.member) && typeof o.role === "string" && ROLES.includes(o.role) ? { a: "role", member: o.member, role: o.role } : null;
    case "remove":
    case "restore":
      return isId(o.member) ? { a: o.a, member: o.member } : null;
    case "editor":
      return isId(o.member) && typeof o.allowed === "boolean" ? { a: "editor", member: o.member, allowed: o.allowed } : null;
    case "rotate":
    case "end":
    case "delete":
      return { a: o.a };
    default:
      return null;
  }
}
__name(parseAdmin, "parseAdmin");
function parseClientMessage(raw) {
  if (typeof raw !== "string" || raw.length > LIMITS.messageBytes) return { ok: false, code: "invalid" };
  if (new TextEncoder().encode(raw).length > LIMITS.messageBytes) return { ok: false, code: "invalid" };
  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    return { ok: false, code: "invalid" };
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) return { ok: false, code: "invalid" };
  const o = j;
  if (o.v !== PROTOCOL_VERSION) return { ok: false, code: "version" };
  switch (o.t) {
    case "ping":
      return { ok: true, msg: { t: "ping", v: PROTOCOL_VERSION } };
    case "hello": {
      if (typeof o.code !== "string" || o.code.length > 128) return { ok: false, code: "invalid" };
      if (typeof o.callsign !== "string" || o.callsign.length > 64) return { ok: false, code: "invalid" };
      if (o.key !== void 0 && (typeof o.key !== "string" || o.key.length > 128)) return { ok: false, code: "invalid" };
      return { ok: true, msg: { t: "hello", v: PROTOCOL_VERSION, code: o.code, callsign: o.callsign, ...o.key ? { key: o.key } : {} } };
    }
    case "op": {
      if (!isId(o.opId) || !o.op || typeof o.op !== "object") return { ok: false, code: "invalid" };
      const op = parseOp(o.op);
      return op ? { ok: true, msg: { t: "op", v: PROTOCOL_VERSION, opId: o.opId, op } } : { ok: false, code: "invalid" };
    }
    case "log": {
      if (!isId(o.opId) || !o.entry || typeof o.entry !== "object" || Array.isArray(o.entry)) return { ok: false, code: "invalid" };
      const e = o.entry;
      if (!isId(e.id) || typeof e.at !== "number" || !isFinite(e.at)) return { ok: false, code: "invalid" };
      return { ok: true, msg: { t: "log", v: PROTOCOL_VERSION, opId: o.opId, entry: { ...e, id: e.id, at: e.at } } };
    }
    case "admin": {
      if (!isId(o.opId) || !o.action || typeof o.action !== "object") return { ok: false, code: "invalid" };
      const action = parseAdmin(o.action);
      return action ? { ok: true, msg: { t: "admin", v: PROTOCOL_VERSION, opId: o.opId, action } } : { ok: false, code: "invalid" };
    }
    default:
      return { ok: false, code: "invalid" };
  }
}
__name(parseClientMessage, "parseClientMessage");
function readCallsign(v) {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  if (s.length < LIMITS.callsignMin || s.length > LIMITS.callsignMax) return null;
  return /^[\p{L}\p{N}_\- ]+$/u.test(s) ? s : null;
}
__name(readCallsign, "readCallsign");
function callsignKey(callsign) {
  return callsign.toLowerCase().replace(/[\s_-]+/g, "");
}
__name(callsignKey, "callsignKey");

// ../src/core/squad/permissions.ts
var staff = /* @__PURE__ */ __name((role) => role !== "soldier", "staff");
function canCreate(role, aff, kind) {
  if (aff === "friend" && kind === "mortar") return staff(role);
  return true;
}
__name(canCreate, "canCreate");
function canMove(_role) {
  return true;
}
__name(canMove, "canMove");
function canEdit(role, m) {
  return m.own || staff(role);
}
__name(canEdit, "canEdit");
function canDelete(role, m) {
  return m.own || staff(role);
}
__name(canDelete, "canDelete");
function canCaption(role, m) {
  return staff(role) || m.own || m.aff === "hostile";
}
__name(canCaption, "canCaption");
function canSetStatus(_role) {
  return true;
}
__name(canSetStatus, "canSetStatus");
function canUseSolution(role) {
  return staff(role);
}
__name(canUseSolution, "canUseSolution");
function canAdmin(role) {
  return role === "commander";
}
__name(canAdmin, "canAdmin");

// ../src/core/squad/room.ts
var IDLE_MS = 3 * 24 * 3600 * 1e3;
var ENDED_MS = 24 * 3600 * 1e3;
var OPS_WINDOW_MS = 6e4;
var OP_MEMORY = 1e3;
var ACTIVITY_WRITE_MS = 36e5;
var metaKey = "meta";
var memberKey = /* @__PURE__ */ __name((id) => `m:${id}`, "memberKey");
var markKey = /* @__PURE__ */ __name((id) => `k:${id}`, "markKey");
var logKey = /* @__PURE__ */ __name((id) => `l:${id}`, "logKey");
var send = /* @__PURE__ */ __name((aud, msg) => ({ k: "send", aud, msg }), "send");
var toMember = /* @__PURE__ */ __name((id, msg) => send({ kind: "member", id }, msg), "toMember");
var reject = /* @__PURE__ */ __name((id, opId, reason) => [toMember(id, { t: "reject", v: PROTOCOL_VERSION, opId, reason })], "reject");
var Room = class _Room {
  static {
    __name(this, "Room");
  }
  state;
  online = /* @__PURE__ */ new Map();
  keyIndex = /* @__PURE__ */ new Map();
  dirty = /* @__PURE__ */ new Set();
  gone = /* @__PURE__ */ new Set();
  seen = /* @__PURE__ */ new Map();
  hits = /* @__PURE__ */ new Map();
  persistedActive;
  constructor(state) {
    this.state = state;
    this.persistedActive = state.lastActive;
    for (const m of Object.values(state.members)) this.keyIndex.set(m.keyHash, m.id);
  }
  /** Нова кімната: її створювач — командир. */
  static create(i) {
    const callsign = readCallsign(i.callsign);
    if (!callsign) throw new Error("bad callsign");
    const state = {
      v: 1,
      createdAt: i.now,
      lastActive: i.now,
      joinHash: i.joinHash,
      phase: "active",
      endedAt: null,
      seq: 0,
      members: { [i.memberId]: { id: i.memberId, callsign, role: "commander", keyHash: i.keyHash, removed: false, editor: false, joinedAt: i.now } },
      marks: {},
      log: []
    };
    const room = new _Room(state);
    room.dirty.add(metaKey).add(memberKey(i.memberId));
    return room;
  }
  /** Відновлення зі сховища (записи, які віддав `takeChanges`). Повертає null, якщо запису кімнати немає. */
  static restore(entries) {
    const meta = entries[metaKey];
    if (!meta || meta.v !== 1) return null;
    const state = { ...meta, members: {}, marks: {}, log: [] };
    for (const [k, v] of Object.entries(entries)) {
      if (k.startsWith("m:")) state.members[v.id] = v;
      else if (k.startsWith("k:")) state.marks[v.id] = v;
      else if (k.startsWith("l:")) state.log.push(v);
    }
    state.log.sort((a, b) => a.s - b.s);
    return new _Room(state);
  }
  takeChanges() {
    const puts = {};
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
  alarmAt() {
    return this.state.phase === "ended" && this.state.endedAt !== null ? this.state.endedAt + ENDED_MS : this.state.lastActive + IDLE_MS;
  }
  onAlarm(now) {
    return now >= this.alarmAt() ? "delete" : "keep";
  }
  // ---------- запити для обгортки ----------
  roleOf(id) {
    const m = this.state.members[id];
    return m && !m.removed ? m.role : null;
  }
  /** Чи належить учасник до аудиторії ефекту (вилучені не належать ніколи). */
  accepts(aud, id) {
    const m = this.state.members[id];
    if (!m || m.removed) return false;
    return aud.kind === "all" || aud.kind === "member" && aud.id === id || aud.kind === "roles" && aud.roles.includes(m.role);
  }
  // ---------- з'єднання ----------
  hello(i) {
    const s = this.state;
    const existingId = i.keyHash ? this.keyIndex.get(i.keyHash) : void 0;
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
  connected(id) {
    const n = (this.online.get(id) ?? 0) + 1;
    this.online.set(id, n);
    return n === 1 ? this.membersEffects() : [];
  }
  disconnected(id) {
    const n = (this.online.get(id) ?? 0) - 1;
    if (n > 0) {
      this.online.set(id, n);
      return [];
    }
    this.online.delete(id);
    return this.state.members[id]?.removed ? [] : this.membersEffects();
  }
  // ---------- повідомлення ----------
  handle(id, msg, now) {
    const m = this.state.members[id];
    if (!m || m.removed) return [{ k: "close", member: id, code: "removed" }];
    if (msg.t === "ping" || msg.t === "hello") return [];
    if (this.seen.has(msg.opId)) return [toMember(id, { t: "ack", v: PROTOCOL_VERSION, opId: msg.opId, seq: this.seen.get(msg.opId) })];
    if (!this.allow(id, now)) return reject(id, msg.opId, "rate");
    if (msg.t === "op") return this.markOp(m, msg.opId, msg.op, now);
    if (msg.t === "log") return this.logEntry(m, msg.opId, msg.entry, now);
    return this.admin(m, msg.opId, msg.action, now);
  }
  /** Нова таємниця для приєднання (хеш рахує обгортка). Лише командир. */
  rotateJoin(id, newJoinHash, now) {
    const m = this.state.members[id];
    if (!m || m.removed || !canAdmin(m.role) || this.state.phase !== "active") return false;
    this.state.joinHash = newJoinHash;
    this.touch(now, true);
    return true;
  }
  // ---------- мітки ----------
  markOp(m, opId, op, now) {
    const s = this.state;
    if (s.phase === "ended") return reject(m.id, opId, "ended");
    const cur = s.marks[op.id];
    if (op.k === "create") {
      if (cur) return cur.del ? reject(m.id, opId, "deleted") : cur.by === m.id ? this.ack(m.id, opId) : reject(m.id, opId, "exists");
      if (!canCreate(m.role, op.aff, op.kind)) return reject(m.id, opId, "permission");
      if (this.liveMarks() >= LIMITS.marks) return reject(m.id, opId, "limit");
      const mark = { id: op.id, aff: op.aff, kind: op.kind, name: op.name, caption: op.caption, x: op.x, z: op.z, u: op.u, destroyed: false, by: m.id, at: now, ub: m.id, ut: now };
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
        if (op.name !== void 0) cur.name = op.name;
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
  accept(m, opId, op, mark, now) {
    const s = this.state;
    s.seq++;
    this.remember(opId);
    this.dirty.add(markKey(mark.id));
    this.touch(now, true);
    const { del: _del, ...pub } = mark;
    return [send({ kind: "all" }, { t: "op", v: PROTOCOL_VERSION, seq: s.seq, opId, by: m.id, at: now, op, mark: mark.del ? null : pub })];
  }
  ack(id, opId) {
    return [toMember(id, { t: "ack", v: PROTOCOL_VERSION, opId, seq: this.state.seq })];
  }
  liveMarks() {
    return Object.values(this.state.marks).filter((k) => !k.del).length;
  }
  trimTombstones() {
    const dead = Object.values(this.state.marks).filter((k) => k.del);
    if (dead.length <= LIMITS.tombstones) return;
    dead.sort((a, b) => a.del.at - b.del.at);
    for (const k of dead.slice(0, dead.length - LIMITS.tombstones)) {
      delete this.state.marks[k.id];
      this.dirty.delete(markKey(k.id));
      this.gone.add(markKey(k.id));
    }
  }
  // ---------- журнал стрільби ----------
  logEntry(m, opId, entry, now) {
    const s = this.state;
    if (!canUseSolution(m.role)) return reject(m.id, opId, "permission");
    if (s.phase === "ended") return reject(m.id, opId, "ended");
    if (s.log.some((e) => e.entry.id === entry.id)) return this.ack(m.id, opId);
    s.seq++;
    const stored = { ...entry, by: m.id };
    s.log.push({ s: s.seq, entry: stored });
    this.dirty.add(logKey(stored.id));
    while (s.log.length > LIMITS.logEntries) {
      const old = s.log.shift();
      this.dirty.delete(logKey(old.entry.id));
      this.gone.add(logKey(old.entry.id));
    }
    this.remember(opId);
    this.touch(now, true);
    return [send({ kind: "roles", roles: ["commander", "mortarman"] }, { t: "log", v: PROTOCOL_VERSION, seq: s.seq, entry: stored })];
  }
  // ---------- керування командира ----------
  admin(m, opId, a, now) {
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
      case "rotate":
        return reject(m.id, opId, "invalid");
      default:
        break;
    }
    const t = s.members[a.member];
    if (!t) return reject(m.id, opId, "unknown");
    const out = [];
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
  snapshot(id) {
    const s = this.state;
    const m = s.members[id];
    const marks = Object.values(s.marks).filter((k) => !k.del).map(({ del: _d, ...k }) => k);
    return {
      t: "snapshot",
      v: PROTOCOL_VERSION,
      seq: s.seq,
      phase: s.phase,
      you: { id: m.id, role: m.role, callsign: m.callsign, editor: m.editor },
      marks,
      members: this.memberList(m.role === "commander"),
      log: canUseSolution(m.role) ? s.log.map((e) => e.entry) : null
    };
  }
  memberList(withRemoved) {
    return Object.values(this.state.members).filter((m) => withRemoved || !m.removed).sort((a, b) => a.joinedAt - b.joinedAt).map((m) => ({ id: m.id, callsign: m.callsign, role: m.role, editor: m.editor, online: this.online.has(m.id), removed: m.removed }));
  }
  /** Список учасників: командир бачить і вилучених (для відновлення), решта — лише чинних. */
  membersEffects() {
    return [
      send({ kind: "roles", roles: ["commander"] }, { t: "members", v: PROTOCOL_VERSION, members: this.memberList(true) }),
      send({ kind: "roles", roles: ["mortarman", "soldier"] }, { t: "members", v: PROTOCOL_VERSION, members: this.memberList(false) })
    ];
  }
  allow(id, now) {
    const list = (this.hits.get(id) ?? []).filter((t) => now - t < OPS_WINDOW_MS);
    if (list.length >= LIMITS.opsPerMinute) {
      this.hits.set(id, list);
      return false;
    }
    list.push(now);
    this.hits.set(id, list);
    return true;
  }
  remember(opId) {
    this.seen.set(opId, this.state.seq);
    if (this.seen.size > OP_MEMORY) this.seen.delete(this.seen.keys().next().value);
  }
  touch(now, force = false) {
    const s = this.state;
    s.lastActive = Math.max(s.lastActive, now);
    if (force || now - this.persistedActive >= ACTIVITY_WRITE_MS) {
      this.dirty.add(metaKey);
      this.persistedActive = s.lastActive;
    }
  }
};

// src/index.ts
var CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};
var PING = JSON.stringify({ t: "ping", v: PROTOCOL_VERSION });
var PONG = JSON.stringify({ t: "pong", v: PROTOCOL_VERSION });
function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hex, "hex");
function randomToken(bytes) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}
__name(randomToken, "randomToken");
async function sha256(text) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}
__name(sha256, "sha256");
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });
}
__name(json, "json");
var src_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/create" && req.method === "POST") {
      let body;
      try {
        body = await req.json();
      } catch {
        return json({ error: "invalid" }, 400);
      }
      const callsign = readCallsign(body.callsign);
      if (!callsign) return json({ error: "bad_callsign" }, 400);
      const room = randomToken(16);
      const code = randomToken(16);
      const key = randomToken(32);
      const memberId = randomToken(8);
      const stub = env.SQUAD.get(env.SQUAD.idFromName(room));
      const ok = await stub.init({ joinHash: await sha256(code), memberId, callsign, keyHash: await sha256(key) });
      return ok ? json({ room, code, key, memberId }) : json({ error: "unavailable" }, 503);
    }
    const m = /^\/ws\/([0-9a-f]{32})$/.exec(url.pathname);
    if (m && req.headers.get("upgrade") === "websocket") {
      return env.SQUAD.get(env.SQUAD.idFromName(m[1])).fetch(req);
    }
    return new Response("not found", { status: 404 });
  }
};
var SquadRoomDO = class extends DurableObject {
  static {
    __name(this, "SquadRoomDO");
  }
  room = null;
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    ctx.blockConcurrencyWhile(async () => {
      this.room = Room.restore(Object.fromEntries(await ctx.storage.list()));
      if (!this.room) return;
      for (const ws of ctx.getWebSockets()) {
        const a = ws.deserializeAttachment();
        if (a?.memberId) this.room.connected(a.memberId);
      }
    });
  }
  /** Створення відділення (викликає Worker). Повертає false, якщо кімната вже є. */
  async init(i) {
    if (this.room) return false;
    this.room = Room.create({ ...i, now: Date.now() });
    await this.flush();
    return true;
  }
  async fetch(_req) {
    if (!this.room) return new Response("gone", { status: 404 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ memberId: null });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async webSocketMessage(ws, data) {
    const room = this.room;
    if (!room) return this.fail(ws, "gone");
    const parsed = parseClientMessage(data);
    if (!parsed.ok) return this.fail(ws, parsed.code === "version" ? "version" : "invalid");
    const msg = parsed.msg;
    const att = ws.deserializeAttachment() ?? { memberId: null };
    const now = Date.now();
    if (msg.t === "hello") {
      if (att.memberId) return this.fail(ws, "invalid");
      const newKey = randomToken(32);
      const newId = randomToken(8);
      const r = room.hello({
        joinHash: await sha256(msg.code),
        callsign: msg.callsign,
        keyHash: msg.key ? await sha256(msg.key) : null,
        newMemberId: newId,
        newKeyHash: await sha256(newKey),
        now
      });
      if (!r.ok) return this.fail(ws, r.code);
      ws.serializeAttachment({ memberId: r.memberId });
      const welcome = { t: "welcome", v: PROTOCOL_VERSION, memberId: r.memberId, ...r.isNew ? { key: newKey } : {} };
      ws.send(JSON.stringify(welcome));
      await this.dispatch([...r.effects, ...room.connected(r.memberId)]);
      return;
    }
    const id = att.memberId;
    if (!id) return this.fail(ws, "invalid");
    if (msg.t === "admin" && msg.action.a === "rotate") {
      if (room.roleOf(id) !== "commander") {
        ws.send(JSON.stringify({ t: "reject", v: PROTOCOL_VERSION, opId: msg.opId, reason: "permission" }));
        return;
      }
      const code = randomToken(16);
      if (room.rotateJoin(id, await sha256(code), now)) ws.send(JSON.stringify({ t: "code", v: PROTOCOL_VERSION, code }));
      await this.flush();
      return;
    }
    await this.dispatch(room.handle(id, msg, now));
  }
  async webSocketClose(ws) {
    await this.left(ws);
  }
  async webSocketError(ws) {
    await this.left(ws);
  }
  async alarm() {
    const room = this.room;
    if (!room) return;
    if (room.onAlarm(Date.now()) === "delete") await this.wipe();
    else await this.ctx.storage.setAlarm(room.alarmAt());
  }
  // ---------- внутрішнє ----------
  async left(ws) {
    const id = ws.deserializeAttachment()?.memberId;
    if (id && this.room) await this.dispatch(this.room.disconnected(id));
  }
  fail(ws, code) {
    try {
      ws.send(JSON.stringify({ t: "error", v: PROTOCOL_VERSION, code }));
      ws.close(1008, code);
    } catch {
    }
  }
  async dispatch(effects) {
    const room = this.room;
    if (!room) return;
    await this.flush();
    const sockets = this.ctx.getWebSockets();
    for (const e of effects) {
      if (e.k === "wipe") return this.wipe();
      for (const ws of sockets) {
        const id = ws.deserializeAttachment()?.memberId;
        if (!id) continue;
        try {
          if (e.k === "close") {
            if (id === e.member) {
              ws.send(JSON.stringify({ t: "error", v: PROTOCOL_VERSION, code: e.code }));
              ws.close(1008, e.code);
            }
          } else if (room.accepts(e.aud, id)) ws.send(JSON.stringify(e.msg));
        } catch {
        }
      }
    }
  }
  /** Записує зміни кімнати в сховище й ставить будильник видалення. */
  async flush() {
    const room = this.room;
    if (!room) return;
    const ch = room.takeChanges();
    if (Object.keys(ch.puts).length) await this.ctx.storage.put(ch.puts);
    if (ch.deletes.length) await this.ctx.storage.delete(ch.deletes);
    await this.ctx.storage.setAlarm(room.alarmAt());
  }
  async wipe() {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(JSON.stringify({ t: "error", v: PROTOCOL_VERSION, code: "gone" }));
        ws.close(1e3, "gone");
      } catch {
      }
    }
    this.room = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-0JTeWc/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-0JTeWc/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  SquadRoomDO,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
