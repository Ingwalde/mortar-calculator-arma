import { describe, expect, it } from "vitest";
import { Room, type Effect } from "./room";
import { PROTOCOL_VERSION as V, type ClientMsg, type ServerMsg, type SquadMark } from "./protocol";
import { SquadSync, applyOp, type Wanted } from "./sync";

const T0 = 1_700_000_000_000;

const want = (id: string, extra: Partial<Wanted> = {}): Wanted => ({ id, aff: "hostile", kind: "infantry", name: "", caption: "", x: 10, z: 20, u: null, w: "", destroyed: false, ...extra });

function toWanted(m: SquadMark): Wanted {
  return { id: m.id, aff: m.aff, kind: m.kind, name: m.name, caption: m.caption, x: m.x, z: m.z, u: m.u, w: m.w, destroyed: m.destroyed };
}

/** Клієнти й справжня кімната: зв'язок вмикається й вимикається, доставка ручна. */
class Net {
  room = Room.create({ joinHash: "h:c", memberId: "cmd", callsign: "Командир", keyHash: "h:kc", now: T0 });
  now = T0;
  syncs = new Map<string, SquadSync>();
  online = new Set<string>();
  /** Мітки застосунку кожного клієнта (те, що він «бачить»). */
  apps = new Map<string, Map<string, Wanted>>();

  constructor() {
    this.add("cmd");
  }

  private keyOf(id: string): string {
    return id === "cmd" ? "h:kc" : "h:k" + id;
  }

  add(id: string): void {
    this.syncs.set(id, new SquadSync(id, { now: () => this.now }));
    this.apps.set(id, new Map());
  }

  join(id: string, name: string): void {
    const r = this.room.hello({ joinHash: "h:c", callsign: name, keyHash: null, newMemberId: id, newKeyHash: "h:k" + id, now: this.now });
    expect(r.ok).toBe(true);
    this.add(id);
    this.connect(id);
  }

  setRole(id: string, role: "mortarman" | "soldier"): void {
    this.deliver(this.room.handle("cmd", { t: "admin", v: V, opId: "role-" + id + role, action: { a: "role", member: id, role } }, this.now));
  }

  /** Зв'язок є: зліпок, потім надсилання черги. */
  connect(id: string): void {
    this.online.add(id);
    this.resync(id);
    this.flush(id);
  }

  disconnect(id: string): void {
    this.online.delete(id);
  }

  private resync(id: string): void {
    const snap = this.room.hello({ joinHash: "", callsign: "", keyHash: this.keyOf(id), newMemberId: "", newKeyHash: "", now: this.now });
    expect(snap.ok).toBe(true);
    if (snap.ok) this.deliver(snap.effects.filter((e) => e.k === "send" && e.msg.t === "snapshot" && this.room.accepts(e.aud, id)));
  }

  /** Користувач змінив мітки в застосунку. */
  edit(id: string, fn: (m: Map<string, Wanted>) => void): void {
    fn(this.apps.get(id)!);
    this.syncs.get(id)!.diff(this.apps.get(id)!.values());
    this.flush(id);
  }

  flush(id: string): void {
    if (!this.online.has(id)) return;
    for (const p of [...this.syncs.get(id)!.pending]) {
      this.now += 10;
      this.deliver(this.room.handle(id, { t: "op", v: V, opId: p.opId, op: p.op } as ClientMsg, this.now));
    }
  }

  deliver(effects: Effect[]): void {
    for (const e of effects) {
      if (e.k !== "send") continue;
      for (const id of [...this.online]) if (this.room.accepts(e.aud, id)) this.receive(id, e.msg);
    }
  }

  receive(id: string, msg: ServerMsg): void {
    const sync = this.syncs.get(id)!;
    const app = this.apps.get(id)!;
    if (msg.t === "snapshot") {
      app.clear();
      for (const m of sync.onSnapshot(msg.marks)) app.set(m.id, toWanted(m));
    } else if (msg.t === "op") {
      const ch = sync.onOp(msg);
      if (ch) {
        if (ch.mark) app.set(ch.id, toWanted(ch.mark));
        else app.delete(ch.id);
      }
    } else if (msg.t === "ack") sync.onAck(msg.opId);
    else if (msg.t === "reject") {
      sync.onReject(msg.opId);
      this.resync(id);
    }
  }

  view(id: string): Wanted[] {
    return [...this.apps.get(id)!.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}

function trio(): Net {
  const n = new Net();
  n.connect("cmd");
  n.join("sol", "Alpha");
  n.join("mor", "Mortar 1");
  n.setRole("mor", "mortarman");
  return n;
}

describe("applyOp", () => {
  it("створення, правка, переміщення, підпис, статус, видалення", () => {
    let m = applyOp(undefined, { k: "create", id: "a", aff: "friend", kind: "mortar", x: 1, z: 2, name: "M", caption: "", u: 5, w: "M252" }, "me", 100)!;
    expect(m).toMatchObject({ by: "me", at: 100, w: "M252", destroyed: false });
    m = applyOp(m, { k: "move", id: "a", x: 9, z: 8, u: null }, "u2", 200)!;
    expect(m).toMatchObject({ x: 9, z: 8, u: null, ub: "u2", ut: 200, by: "me" });
    m = applyOp(m, { k: "caption", id: "a", caption: "hi" }, "u2", 300)!;
    expect(m.caption).toBe("hi");
    expect(applyOp(m, { k: "delete", id: "a" }, "u2", 400)).toBeNull();
    expect(applyOp(undefined, { k: "move", id: "zz", x: 1, z: 1, u: null }, "u", 1)).toBeNull();
  });
});

describe("SquadSync.diff", () => {
  it("нова мітка — створення; без змін — порожньо", () => {
    const s = new SquadSync("me");
    const ops = s.diff([want("a")]);
    expect(ops.map((p) => p.op.k)).toEqual(["create"]);
    expect(s.diff([want("a")])).toEqual([]);
  });

  it("кожна зміна дає свою дію, видалення — delete", () => {
    const s = new SquadSync("me");
    s.diff([want("a")]);
    expect(s.diff([want("a", { x: 99 })]).map((p) => p.op.k)).toEqual(["move"]);
    expect(s.diff([want("a", { x: 99, caption: "c" })]).map((p) => p.op.k)).toEqual(["caption"]);
    expect(s.diff([want("a", { x: 99, caption: "c", destroyed: true })]).map((p) => p.op.k)).toEqual(["status"]);
    expect(s.diff([want("a", { x: 99, caption: "c", destroyed: true, name: "N", kind: "armour" })]).map((p) => p.op.k)).toEqual(["edit"]);
    expect(s.diff([]).map((p) => p.op.k)).toEqual(["delete"]);
  });

  it("черга й дзеркало зберігаються й відновлюються з дампа", () => {
    const s = new SquadSync("me");
    s.diff([want("a"), want("b")]);
    const copy = new SquadSync("me", { dump: JSON.parse(JSON.stringify(s.toJSON())) });
    expect(copy.pending).toEqual(s.pending);
    expect(copy.marks().map((m) => m.id).sort()).toEqual(["a", "b"]);
    expect(copy.diff([want("a"), want("b")])).toEqual([]);
    // дамп іншого учасника не береться
    expect(new SquadSync("other", { dump: s.toJSON() }).pending).toEqual([]);
  });
});

describe("клієнти через справжню кімнату", () => {
  it("солдат позначає ворога — командир і мінометник бачать мітку", () => {
    const n = trio();
    n.edit("sol", (m) => m.set("t1", want("t1", { kind: "armour", name: "Танк", x: 500, z: 600 })));
    for (const id of ["cmd", "mor", "sol"]) expect(n.view(id).map((m) => m.id)).toEqual(["t1"]);
    expect(n.view("mor")[0]).toMatchObject({ kind: "armour", name: "Танк", x: 500 });
    expect(n.room.state.marks.t1.by).toBe("sol");
  });

  it("зміни різних учасників сходяться до одного стану", () => {
    const n = trio();
    n.edit("sol", (m) => m.set("a", want("a")));
    n.edit("mor", (m) => {
      m.set("mort", want("mort", { aff: "friend", kind: "mortar", w: "M252", x: 1, z: 1 }));
    });
    n.edit("sol", (m) => m.set("mort", { ...m.get("mort")!, x: 7, z: 8 }));
    n.edit("cmd", (m) => m.set("a", { ...m.get("a")!, caption: "кулемет", destroyed: true }));
    const a = JSON.stringify(n.view("cmd"));
    expect(JSON.stringify(n.view("mor"))).toBe(a);
    expect(JSON.stringify(n.view("sol"))).toBe(a);
    expect(n.view("cmd").find((m) => m.id === "mort")).toMatchObject({ x: 7, z: 8, w: "M252" });
    expect(n.view("cmd").find((m) => m.id === "a")).toMatchObject({ caption: "кулемет", destroyed: true });
  });

  it("відключений клієнт працює далі, а після повернення зв'язку черга доходить без втрат і без дублів", () => {
    const n = trio();
    n.disconnect("sol");
    n.edit("sol", (m) => {
      m.set("o1", want("o1"));
      m.set("o2", want("o2", { x: 5 }));
    });
    n.edit("mor", (m) => m.set("m1", want("m1", { kind: "helicopter" })));
    expect(n.view("mor").map((m) => m.id)).toEqual(["m1"]);
    expect(n.syncs.get("sol")!.pending.length).toBe(2);
    n.connect("sol");
    for (const id of ["cmd", "mor", "sol"]) expect(n.view(id).map((m) => m.id)).toEqual(["m1", "o1", "o2"]);
    expect(n.syncs.get("sol")!.pending).toEqual([]);
    // повторне з'єднання нічого не ламає
    const seq = n.room.state.seq;
    n.connect("sol");
    expect(n.room.state.seq).toBe(seq);
  });

  it("відмова (немає прав) повертає застосунок до стану сервера", () => {
    const n = trio();
    n.edit("mor", (m) => m.set("mort", want("mort", { aff: "friend", kind: "mortar", w: "M252" })));
    // солдат намагається видалити чужий міномет
    n.edit("sol", (m) => m.delete("mort"));
    expect(n.view("sol").map((m) => m.id)).toEqual(["mort"]);
    expect(n.view("cmd").map((m) => m.id)).toEqual(["mort"]);
    expect(n.syncs.get("sol")!.pending).toEqual([]);
  });

  it("солдат не створює свій міномет: мітка зникає в нього після відмови", () => {
    const n = trio();
    n.edit("sol", (m) => m.set("x", want("x", { aff: "friend", kind: "mortar", w: "M252" })));
    expect(n.view("sol")).toEqual([]);
    expect(n.view("cmd")).toEqual([]);
  });

  it("мітку, видалену іншим, застосунок прибирає, а відкладену зміну над нею відкидає", () => {
    const n = trio();
    n.edit("mor", (m) => m.set("t", want("t")));
    n.disconnect("sol");
    n.edit("sol", (m) => m.set("t", { ...m.get("t")!, x: 77 }));
    n.edit("mor", (m) => m.delete("t"));
    n.connect("sol");
    expect(n.view("sol")).toEqual([]);
    expect(n.view("cmd")).toEqual([]);
  });

  it("чужа зміна під час нашої неприйнятої правки не губить нашу правку", () => {
    const n = trio();
    n.edit("cmd", (m) => m.set("t", want("t")));
    n.disconnect("sol");
    n.edit("sol", (m) => m.set("t", { ...m.get("t")!, caption: "моє" }));
    n.edit("mor", (m) => m.set("t", { ...m.get("t")!, x: 123 }));
    n.connect("sol");
    for (const id of ["cmd", "mor", "sol"]) expect(n.view(id)[0]).toMatchObject({ caption: "моє", x: 123 });
  });
});
