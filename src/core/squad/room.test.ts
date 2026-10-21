import { describe, expect, it } from "vitest";
import { ENDED_MS, IDLE_MS, Room, type Effect } from "./room";
import { LIMITS, PROTOCOL_VERSION as V, type ClientMsg, type MarkOp, type Role, type ServerMsg } from "./protocol";

const T0 = 1_700_000_000_000;

/** Проста «обгортка»: хеші замінені префіксами, ідентифікатори й ключі лічильником. */
class Harness {
  room: Room;
  now = T0;
  private n = 0;
  readonly keys: Record<string, string> = {};
  readonly ids: Record<string, string> = {};
  /** Усе, що кімната надіслала кожному учаснику. */
  readonly inbox: Record<string, ServerMsg[]> = {};
  readonly closed: string[] = [];
  wiped = false;

  constructor() {
    this.room = Room.create({ joinHash: "h:code1", memberId: "cmd", callsign: "Командир", keyHash: "h:key-cmd", now: T0 });
    this.keys.cmd = "key-cmd";
    this.ids.cmd = "cmd";
    this.inbox.cmd = [];
  }

  /** Новий учасник приєднується з поточним кодом. */
  join(name: string, code = "code1"): Effect[] | string {
    const id = `m${++this.n}`;
    const r = this.room.hello({ joinHash: `h:${code}`, callsign: name, keyHash: null, newMemberId: id, newKeyHash: `h:key-${id}`, now: this.now });
    if (!r.ok) return r.code;
    this.keys[name] = `key-${id}`;
    this.ids[name] = id;
    this.inbox[id] = [];
    this.apply(r.effects);
    return r.effects;
  }

  rejoin(name: string): string | "ok" {
    const r = this.room.hello({ joinHash: "h:none", callsign: "x", keyHash: `h:${this.keys[name]}`, newMemberId: "unused", newKeyHash: "h:unused", now: this.now });
    if (!r.ok) return r.code;
    this.apply(r.effects);
    return "ok";
  }

  id(name: string): string {
    return name === "Командир" ? "cmd" : this.ids[name];
  }

  send(name: string, msg: ClientMsg, dt = 0): Effect[] {
    this.now += dt;
    const e = this.room.handle(this.id(name), msg, this.now);
    this.apply(e);
    return e;
  }

  op(name: string, opId: string, op: MarkOp, dt = 0): Effect[] {
    return this.send(name, { t: "op", v: V, opId, op }, dt);
  }

  admin(opId: string, action: Extract<ClientMsg, { t: "admin" }>["action"]): Effect[] {
    return this.send("Командир", { t: "admin", v: V, opId, action });
  }

  /** Останнє повідомлення типу `t` для учасника. */
  last(name: string, t: ServerMsg["t"]): ServerMsg | undefined {
    return [...this.inbox[this.id(name)]].reverse().find((m) => m.t === t);
  }

  private apply(effects: Effect[]): void {
    for (const e of effects) {
      if (e.k === "close") this.closed.push(e.member);
      else if (e.k === "wipe") this.wiped = true;
      else {
        for (const [id, box] of Object.entries(this.inbox)) {
          const m = this.room.state.members[id];
          if (m.removed) continue;
          const a = e.aud;
          if (a.kind === "all" || (a.kind === "member" && a.id === id) || (a.kind === "roles" && a.roles.includes(m.role))) box.push(e.msg);
        }
      }
    }
  }
}

const create = (id: string, extra: Partial<Extract<MarkOp, { k: "create" }>> = {}): MarkOp => ({ k: "create", id, aff: "hostile", kind: "infantry", x: 10, z: 20, name: "", caption: "", u: null, ...extra });
const reasonOf = (e: Effect[]): string | undefined => {
  const f = e.find((x) => x.k === "send" && x.msg.t === "reject");
  return f && f.k === "send" && f.msg.t === "reject" ? f.msg.reason : undefined;
};

function squad(): Harness {
  const h = new Harness();
  h.join("Alpha");
  h.join("Bravo");
  h.admin("r1", { a: "role", member: h.id("Alpha"), role: "mortarman" });
  return h;
}

describe("приєднання", () => {
  it("новий учасник стає солдатом і бачить зліпок; усі отримують список учасників", () => {
    const h = new Harness();
    expect(h.join("Alpha")).not.toBeTypeOf("string");
    const snap = h.last("Alpha", "snapshot");
    expect(snap && snap.t === "snapshot" && snap.you.role).toBe("soldier");
    expect(snap && snap.t === "snapshot" && snap.log).toBeNull();
    const list = h.last("Командир", "members");
    expect(list && list.t === "members" && list.members.map((m) => m.callsign)).toEqual(["Командир", "Alpha"]);
  });

  it("неправильний код, зайнятий і схожий позивний, поганий позивний", () => {
    const h = new Harness();
    expect(h.join("Alpha", "wrong")).toBe("bad_code");
    h.join("Alpha-2");
    expect(h.join("alpha 2")).toBe("callsign_taken");
    expect(h.join("ALPHA_2")).toBe("callsign_taken");
    expect(h.join("A")).toBe("bad_callsign");
    expect(h.join("x<y>")).toBe("bad_callsign");
  });

  it("не більше 20 учасників", () => {
    const h = new Harness();
    for (let i = 1; i < LIMITS.members; i++) expect(h.join(`Unit${i}`)).not.toBeTypeOf("string");
    expect(h.join("Overflow")).toBe("full");
  });

  it("повернення з ключем не потребує коду, навіть після його заміни", () => {
    const h = new Harness();
    h.join("Alpha");
    expect(h.room.rotateJoin("cmd", "h:code2", h.now)).toBe(true);
    expect(h.rejoin("Alpha")).toBe("ok");
    expect(h.join("Bravo", "code1")).toBe("bad_code");
    expect(h.join("Bravo", "code2")).not.toBeTypeOf("string");
  });

  it("заміна коду лише командиром", () => {
    const h = squad();
    expect(h.room.rotateJoin(h.id("Alpha"), "h:x", h.now)).toBe(false);
    expect(h.room.rotateJoin(h.id("Bravo"), "h:x", h.now)).toBe(false);
  });

  it("онлайн-статус розсилається при першому підключенні й останньому відключенні", () => {
    const h = squad();
    const a = h.id("Alpha");
    expect(h.room.connected(a)).toHaveLength(2);
    expect(h.room.connected(a)).toHaveLength(0);
    expect(h.room.disconnected(a)).toHaveLength(0);
    expect(h.room.disconnected(a)).toHaveLength(2);
  });
});

describe("мітки: права по ролях", () => {
  it("солдат не створює свій міномет, але створює ворожі й свої інші мітки", () => {
    const h = squad();
    expect(reasonOf(h.op("Bravo", "o1", create("k1", { aff: "friend", kind: "mortar" })))).toBe("permission");
    expect(reasonOf(h.op("Bravo", "o2", create("k2", { aff: "hostile", kind: "armour" })))).toBeUndefined();
    expect(reasonOf(h.op("Bravo", "o3", create("k3", { aff: "friend", kind: "infantry" })))).toBeUndefined();
    expect(reasonOf(h.op("Alpha", "o4", create("k4", { aff: "friend", kind: "mortar" })))).toBeUndefined();
    expect(reasonOf(h.op("Командир", "o5", create("k5", { aff: "friend", kind: "mortar" })))).toBeUndefined();
  });

  it("солдат пересуває будь-яку мітку, навіть міномет, але не видаляє й не міняє чужі", () => {
    const h = squad();
    h.op("Alpha", "o1", create("mort", { aff: "friend", kind: "mortar" }));
    expect(reasonOf(h.op("Bravo", "o2", { k: "move", id: "mort", x: 50, z: 60, u: null }))).toBeUndefined();
    expect(h.room.state.marks.mort.x).toBe(50);
    expect(reasonOf(h.op("Bravo", "o3", { k: "delete", id: "mort" }))).toBe("permission");
    expect(reasonOf(h.op("Bravo", "o4", { k: "edit", id: "mort", name: "X" }))).toBe("permission");
    expect(reasonOf(h.op("Alpha", "o5", { k: "edit", id: "mort", name: "М-1" }))).toBeUndefined();
  });

  it("солдат не перетворює свою мітку на свій міномет", () => {
    const h = squad();
    h.op("Bravo", "o1", create("k1", { aff: "friend", kind: "infantry" }));
    expect(reasonOf(h.op("Bravo", "o2", { k: "edit", id: "k1", kind: "mortar" }))).toBe("permission");
    expect(reasonOf(h.op("Alpha", "o3", { k: "edit", id: "k1", kind: "mortar" }))).toBeUndefined();
  });

  it("підпис: солдат до своїх і ворожих, але не до чужих своїх", () => {
    const h = squad();
    h.op("Alpha", "o1", create("f", { aff: "friend", kind: "infantry" }));
    h.op("Alpha", "o2", create("e", { aff: "hostile", kind: "infantry" }));
    expect(reasonOf(h.op("Bravo", "o3", { k: "caption", id: "f", caption: "ні" }))).toBe("permission");
    expect(reasonOf(h.op("Bravo", "o4", { k: "caption", id: "e", caption: "кулемет" }))).toBeUndefined();
    expect(h.room.state.marks.e.caption).toBe("кулемет");
  });

  it("статус «зруйновано» для всіх, але не для свого міномета", () => {
    const h = squad();
    h.op("Alpha", "o1", create("t"));
    h.op("Alpha", "o2", create("mort", { aff: "friend", kind: "mortar" }));
    expect(reasonOf(h.op("Bravo", "o3", { k: "status", id: "t", destroyed: true }))).toBeUndefined();
    expect(h.room.state.marks.t.destroyed).toBe(true);
    expect(reasonOf(h.op("Bravo", "o4", { k: "status", id: "mort", destroyed: true }))).toBe("invalid");
  });

  it("автор мітки й час записуються сервером", () => {
    const h = squad();
    h.op("Bravo", "o1", create("k1"), 5000);
    const k = h.room.state.marks.k1;
    expect(k.by).toBe(h.id("Bravo"));
    expect(k.at).toBe(h.now);
  });
});

describe("мітки: порядок, дублі, видалення, ліміти", () => {
  it("номер послідовності зростає на кожну прийняту дію й іде в розсилці", () => {
    const h = squad();
    h.op("Alpha", "o1", create("k1"));
    h.op("Alpha", "o2", create("k2"));
    const seqs = h.inbox.cmd.filter((m) => m.t === "op").map((m) => (m.t === "op" ? m.seq : 0));
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
  });

  it("повтор того самого opId не застосовується вдруге: приходить лише підтвердження", () => {
    const h = squad();
    h.op("Alpha", "dup", create("k1"));
    const before = h.room.state.seq;
    const e = h.op("Alpha", "dup", create("k1"));
    expect(h.room.state.seq).toBe(before);
    expect(e).toHaveLength(1);
    expect(e[0].k === "send" && e[0].msg.t).toBe("ack");
  });

  it("повтор створення з новим opId тим самим автором (після пробудження кімнати) теж лише підтверджується", () => {
    const h = squad();
    h.op("Alpha", "o1", create("k1"));
    const before = h.room.state.seq;
    const e = h.op("Alpha", "o2", create("k1"));
    expect(h.room.state.seq).toBe(before);
    expect(e[0].k === "send" && e[0].msg.t).toBe("ack");
    expect(reasonOf(h.op("Bravo", "o3", create("k1")))).toBe("exists");
  });

  it("видалена мітка лишає надгробок: пізня зміна відхиляється, повторне створення теж", () => {
    const h = squad();
    h.op("Alpha", "o1", create("k1"));
    h.op("Alpha", "o2", { k: "delete", id: "k1" });
    expect(reasonOf(h.op("Bravo", "o3", { k: "move", id: "k1", x: 1, z: 1, u: null }))).toBe("deleted");
    expect(reasonOf(h.op("Alpha", "o4", create("k1")))).toBe("deleted");
    expect(reasonOf(h.op("Alpha", "o5", { k: "move", id: "nope", x: 1, z: 1, u: null }))).toBe("unknown");
    const snap = h.room.hello({ joinHash: "", callsign: "", keyHash: "h:" + h.keys.Bravo, newMemberId: "", newKeyHash: "", now: h.now });
    const marks = snap.ok ? h.room["snapshot"](snap.memberId) : null;
    expect(marks && marks.t === "snapshot" && marks.marks).toEqual([]);
  });

  it("не більше 100 живих міток; після видалення місце звільняється", () => {
    const h = squad();
    for (let i = 0; i < LIMITS.marks; i++) h.op("Alpha", `c${i}`, create(`k${i}`), 2000);
    expect(reasonOf(h.op("Alpha", "x1", create("over"), 2000))).toBe("limit");
    h.op("Alpha", "x2", { k: "delete", id: "k0" }, 2000);
    expect(reasonOf(h.op("Alpha", "x3", create("over"), 2000))).toBeUndefined();
  });

  it("не більше 40 дій на хвилину від учасника; за хвилину ліміт скидається", () => {
    const h = squad();
    for (let i = 0; i < LIMITS.opsPerMinute; i++) expect(reasonOf(h.op("Alpha", `a${i}`, create(`k${i}`), 100))).toBeUndefined();
    expect(reasonOf(h.op("Alpha", "late", create("kx"), 100))).toBe("rate");
    // інший учасник не страждає
    expect(reasonOf(h.op("Bravo", "b1", create("kb")))).toBeUndefined();
    expect(reasonOf(h.op("Alpha", "later", create("ky"), 61_000))).toBeUndefined();
  });
});

describe("журнал стрільби", () => {
  it("записує й розсилає лише командиру й мінометникам; солдат не бачить і не пише", () => {
    const h = squad();
    const entry = { id: "e1", at: T0, mortarName: "М-1", shell: "HE" };
    expect(reasonOf(h.send("Bravo", { t: "log", v: V, opId: "l1", entry }))).toBe("permission");
    expect(reasonOf(h.send("Alpha", { t: "log", v: V, opId: "l2", entry }))).toBeUndefined();
    expect(h.last("Командир", "log")).toBeTruthy();
    expect(h.last("Bravo", "log")).toBeUndefined();
    expect(h.room.state.log[0].entry.by).toBe(h.id("Alpha"));
    // повтор запису не дублюється
    h.send("Alpha", { t: "log", v: V, opId: "l3", entry });
    expect(h.room.state.log).toHaveLength(1);
  });

  it("зліпок для мінометника містить журнал, для солдата — ні", () => {
    const h = squad();
    h.send("Alpha", { t: "log", v: V, opId: "l1", entry: { id: "e1", at: T0 } });
    h.rejoin("Alpha");
    h.rejoin("Bravo");
    const a = h.last("Alpha", "snapshot");
    const b = h.last("Bravo", "snapshot");
    expect(a && a.t === "snapshot" && a.log).toHaveLength(1);
    expect(b && b.t === "snapshot" && b.log).toBeNull();
  });

  it("зберігає не більше 200 записів", () => {
    const h = squad();
    for (let i = 0; i < LIMITS.logEntries + 5; i++) h.send("Alpha", { t: "log", v: V, opId: `l${i}`, entry: { id: `e${i}`, at: T0 + i } }, 2000);
    expect(h.room.state.log).toHaveLength(LIMITS.logEntries);
    expect(h.room.state.log[0].entry.id).toBe("e5");
  });
});

describe("керування командира", () => {
  it("тільки командир керує", () => {
    const h = squad();
    const e = h.send("Alpha", { t: "admin", v: V, opId: "x", action: { a: "end" } });
    expect(reasonOf(e)).toBe("permission");
    expect(h.room.state.phase).toBe("active");
    expect(reasonOf(h.send("Bravo", { t: "admin", v: V, opId: "y", action: { a: "role", member: h.id("Bravo"), role: "commander" } }))).toBe("permission");
  });

  it("зміна ролі дає учаснику новий зліпок із правами; передача командування робить колишнього мінометником", () => {
    const h = squad();
    const before = h.room.state.members[h.id("Bravo")].role;
    expect(before).toBe("soldier");
    h.admin("r2", { a: "role", member: h.id("Bravo"), role: "mortarman" });
    const snap = h.last("Bravo", "snapshot");
    expect(snap && snap.t === "snapshot" && snap.you.role).toBe("mortarman");
    expect(snap && snap.t === "snapshot" && snap.log).toEqual([]);
    h.admin("r3", { a: "role", member: h.id("Bravo"), role: "commander" });
    expect(h.room.state.members[h.id("Bravo")].role).toBe("commander");
    expect(h.room.state.members.cmd.role).toBe("mortarman");
    expect(Object.values(h.room.state.members).filter((m) => m.role === "commander")).toHaveLength(1);
  });

  it("вилучений не читає, не пише, не повертається з тим самим ключем; відновлення повертає доступ", () => {
    const h = squad();
    h.op("Bravo", "o1", create("k1"));
    const e = h.admin("rm", { a: "remove", member: h.id("Bravo") });
    expect(e.some((x) => x.k === "close" && x.member === h.id("Bravo"))).toBe(true);
    expect(h.rejoin("Bravo")).toBe("removed");
    const after = h.send("Bravo", { t: "op", v: V, opId: "o2", op: create("k2") });
    expect(after[0]).toEqual({ k: "close", member: h.id("Bravo"), code: "removed" });
    // його мітки лишаються
    expect(h.room.state.marks.k1).toBeTruthy();
    // звичайні учасники не бачать вилучених, командир бачить
    const forCmd = h.last("Командир", "members");
    const forAlpha = h.last("Alpha", "members");
    expect(forCmd && forCmd.t === "members" && forCmd.members.find((m) => m.callsign === "Bravo")?.removed).toBe(true);
    expect(forAlpha && forAlpha.t === "members" && forAlpha.members.some((m) => m.callsign === "Bravo")).toBe(false);
    // позивний лишається зайнятим
    expect(h.join("bravo")).toBe("callsign_taken");
    h.admin("rs", { a: "restore", member: h.id("Bravo") });
    expect(h.rejoin("Bravo")).toBe("ok");
  });

  it("командира й себе вилучити не можна", () => {
    const h = squad();
    expect(reasonOf(h.admin("a", { a: "remove", member: "cmd" }))).toBe("permission");
  });

  it("дозвіл редагувати звіт ставиться й знімається", () => {
    const h = squad();
    h.admin("e1", { a: "editor", member: h.id("Bravo"), allowed: true });
    expect(h.room.state.members[h.id("Bravo")].editor).toBe(true);
    h.admin("e2", { a: "editor", member: h.id("Bravo"), allowed: false });
    expect(h.room.state.members[h.id("Bravo")].editor).toBe(false);
  });

  it("гра закінчена: мітки й журнал лише для читання, нових учасників не приймає", () => {
    const h = squad();
    h.op("Alpha", "o1", create("k1"));
    h.admin("end", { a: "end" });
    expect(h.room.state.phase).toBe("ended");
    expect(h.last("Bravo", "ended")).toBeTruthy();
    expect(reasonOf(h.op("Alpha", "o2", create("k2")))).toBe("ended");
    expect(reasonOf(h.op("Bravo", "o3", { k: "move", id: "k1", x: 1, z: 1, u: null }))).toBe("ended");
    expect(reasonOf(h.send("Alpha", { t: "log", v: V, opId: "l", entry: { id: "e", at: T0 } }))).toBe("ended");
    expect(h.join("Charlie")).toBe("ended");
    expect(h.rejoin("Alpha")).toBe("ok");
    expect(reasonOf(h.admin("end2", { a: "end" }))).toBe("ended");
  });

  it("видалення відділення віддає ефект стирання", () => {
    const h = squad();
    h.admin("del", { a: "delete" });
    expect(h.wiped).toBe(true);
  });
});

describe("зберігання й час життя", () => {
  it("записи зі сховища відновлюють ту саму кімнату", () => {
    const h = squad();
    h.op("Alpha", "o1", create("k1", { name: "Танк", caption: "міст" }));
    h.op("Bravo", "o2", create("k2"));
    h.op("Alpha", "o3", { k: "delete", id: "k2" });
    h.send("Alpha", { t: "log", v: V, opId: "l1", entry: { id: "e1", at: T0 } });
    h.admin("end", { a: "end" });
    const stored: Record<string, unknown> = {};
    const ch = h.room.takeChanges();
    Object.assign(stored, ch.puts);
    const copy = Room.restore(JSON.parse(JSON.stringify(stored)));
    expect(copy).not.toBeNull();
    expect(copy!.state).toEqual(h.room.state);
    // повторне читання змін нічого не дає
    expect(h.room.takeChanges()).toEqual({ puts: {}, deletes: [] });
  });

  it("зміна однієї мітки зачіпає лише її запис і службовий запис", () => {
    const h = squad();
    h.op("Alpha", "o1", create("k1"));
    h.room.takeChanges();
    h.op("Alpha", "o2", { k: "move", id: "k1", x: 5, z: 6, u: null });
    const ch = h.room.takeChanges();
    expect(Object.keys(ch.puts).sort()).toEqual(["k:k1", "meta"]);
  });

  it("порожнє сховище — немає кімнати", () => {
    expect(Room.restore({})).toBeNull();
  });

  it("будильник: 3 дні без дій або 24 години після кінця гри", () => {
    const h = squad();
    expect(h.room.alarmAt()).toBe(h.room.state.lastActive + IDLE_MS);
    expect(h.room.onAlarm(h.room.alarmAt() - 1)).toBe("keep");
    expect(h.room.onAlarm(h.room.alarmAt())).toBe("delete");
    h.now += 1000;
    h.admin("end", { a: "end" });
    expect(h.room.alarmAt()).toBe(h.now + ENDED_MS);
  });

  it("надгробків не більше 300: найстаріші стираються зі сховища", () => {
    const h = squad();
    const total = LIMITS.tombstones + 3;
    for (let i = 0; i < total; i++) {
      h.op("Alpha", `c${i}`, create(`k${i}`), 61_000);
      h.op("Alpha", `d${i}`, { k: "delete", id: `k${i}` }, 61_000);
    }
    expect(Object.keys(h.room.state.marks)).toHaveLength(LIMITS.tombstones);
    expect(h.room.takeChanges().deletes).toContain("k:k0");
  });
});

describe("навантаження: 20 клієнтів", () => {
  it("20 учасників по 30 дій не порушують ліміти й дають суворо зростаючі номери", () => {
    const h = new Harness();
    for (let i = 1; i < LIMITS.members; i++) h.join(`Unit${i}`);
    const names = ["Командир", ...Array.from({ length: LIMITS.members - 1 }, (_, i) => `Unit${i + 1}`)];
    const roles: Role[] = [];
    let accepted = 0;
    for (let round = 0; round < 30; round++) {
      for (const [i, n] of names.entries()) {
        const id = `c${round}-${i}`;
        const e = round % 3 === 0 ? h.op(n, id, create(`m${round}-${i}`, { x: i, z: round }), 50) : h.op(n, id, { k: "move", id: `m${(round - (round % 3))}-${i}`, x: round, z: i, u: null }, 50);
        if (!reasonOf(e)) accepted++;
      }
      roles.push("soldier");
    }
    expect(accepted).toBeGreaterThan(0);
    expect(Object.values(h.room.state.marks).filter((k) => !k.del).length).toBeLessThanOrEqual(LIMITS.marks);
    const seqs = h.inbox.cmd.filter((m) => m.t === "op").map((m) => (m.t === "op" ? m.seq : 0));
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
  });
});
