// End-to-end check of the relay against a running `wrangler dev` (default http://127.0.0.1:8788).
// Run: npm run dev (in one terminal), then: node test/e2e.mjs
import assert from "node:assert/strict";

const BASE = process.env.RELAY ?? "http://127.0.0.1:8788";
const V = 1;

class Client {
  constructor(name) {
    this.name = name;
    this.inbox = [];
    this.waiters = [];
  }
  async open(room, hello) {
    this.ws = new WebSocket(BASE.replace("http", "ws") + "/ws/" + room);
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      this.inbox.push(m);
      this.waiters = this.waiters.filter((w) => !w(m));
    };
    this.closed = new Promise((r) => (this.ws.onclose = (e) => r(e)));
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = () => rej(new Error("ws error"));
    });
    this.ws.send(JSON.stringify({ t: "hello", v: V, ...hello }));
    const w = await this.next((m) => m.t === "welcome" || m.t === "error");
    if (w.t === "welcome") {
      this.memberId = w.memberId;
      if (w.key) this.key = w.key;
      await this.next((m) => m.t === "snapshot");
    }
    return w;
  }
  send(m) {
    this.ws.send(JSON.stringify({ v: V, ...m }));
  }
  next(pred, ms = 4000) {
    const hit = this.inbox.find(pred);
    if (hit) {
      this.inbox.splice(this.inbox.indexOf(hit), 1);
      return Promise.resolve(hit);
    }
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error(`${this.name}: timeout waiting`)), ms);
      this.waiters.push((m) => {
        if (!pred(m)) return false;
        clearTimeout(t);
        this.inbox.splice(this.inbox.indexOf(m), 1);
        res(m);
        return true;
      });
    });
  }
  close() {
    this.ws.close();
  }
}

const post = (path, body) => fetch(BASE + path, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());

const sq = await post("/create", { callsign: "Wolf" });
assert.ok(sq.room && sq.code && sq.key, "create returns room, code and key");

const cmd = new Client("cmd");
await cmd.open(sq.room, { code: sq.code, callsign: "Wolf", key: sq.key });

const bad = new Client("bad");
const r = await bad.open(sq.room, { code: "0".repeat(32), callsign: "Spy" });
assert.equal(r.code, "bad_code");

const sold = new Client("soldier");
await sold.open(sq.room, { code: sq.code, callsign: "Alpha-2" });
assert.ok(sold.key, "a new member receives a key");
const mort = new Client("mortar");
await mort.open(sq.room, { code: sq.code, callsign: "Mortar 1" });

cmd.send({ t: "admin", opId: "a1", action: { a: "role", member: mort.memberId, role: "mortarman" } });
const promoted = await mort.next((m) => m.t === "snapshot");
assert.equal(promoted.you.role, "mortarman");

// the soldier marks a hostile, everybody sees it with the author
sold.send({ t: "op", opId: "s1", op: { k: "create", id: "k1", aff: "hostile", kind: "armour", x: 1200, z: 3400, name: "T-72", caption: "by the bridge", u: null, w: "" } });
for (const c of [cmd, mort, sold]) {
  const op = await c.next((m) => m.t === "op" && m.opId === "s1");
  assert.equal(op.by, sold.memberId);
  assert.equal(op.mark.kind, "armour");
}

// the soldier cannot create a friendly mortar, but may move one made by the mortarman
sold.send({ t: "op", opId: "s2", op: { k: "create", id: "k2", aff: "friend", kind: "mortar", x: 1, z: 1, name: "", caption: "", u: null, w: "" } });
assert.equal((await sold.next((m) => m.t === "reject")).reason, "permission");
mort.send({ t: "op", opId: "m1", op: { k: "create", id: "k3", aff: "friend", kind: "mortar", x: 100, z: 100, name: "M1", caption: "", u: null, w: "" } });
await sold.next((m) => m.t === "op" && m.opId === "m1");
sold.send({ t: "op", opId: "s3", op: { k: "move", id: "k3", x: 150, z: 160, u: null } });
await mort.next((m) => m.t === "op" && m.opId === "s3");

// the firing log goes to the mortarman and the commander only
mort.send({ t: "log", opId: "l1", entry: { id: "e1", at: Date.now(), mortarName: "M1", shell: "HE" } });
assert.equal((await cmd.next((m) => m.t === "log")).entry.by, mort.memberId);
await new Promise((r) => setTimeout(r, 300));
assert.equal(sold.inbox.filter((m) => m.t === "log").length, 0, "the soldier does not see the log");

// duplicates are not applied twice
sold.send({ t: "op", opId: "s1", op: { k: "create", id: "k1", aff: "hostile", kind: "armour", x: 1200, z: 3400, name: "T-72", caption: "", u: null, w: "" } });
assert.equal((await sold.next((m) => m.t === "ack")).opId, "s1");

// the commander removes the soldier; the soldier is disconnected and cannot come back
cmd.send({ t: "admin", opId: "a2", action: { a: "remove", member: sold.memberId } });
assert.equal((await sold.next((m) => m.t === "error")).code, "removed");
const again = new Client("soldier-again");
assert.equal((await again.open(sq.room, { code: "x", callsign: "Alpha-2", key: sold.key })).code, "removed");

// ...and restores him; he reconnects with the same key and sees all the marks
cmd.send({ t: "admin", opId: "a3", action: { a: "restore", member: sold.memberId } });
await new Promise((r) => setTimeout(r, 300));
const back = new Client("soldier-back");
const w = await back.open(sq.room, { code: "x", callsign: "Alpha-2", key: sold.key });
assert.equal(w.t, "welcome");
assert.equal(w.memberId, sold.memberId);

// a soldier who is not the commander cannot rotate the code; the commander can
back.send({ t: "admin", opId: "a4", action: { a: "rotate" } });
assert.equal((await back.next((m) => m.t === "reject")).reason, "permission");
cmd.send({ t: "admin", opId: "a5", action: { a: "rotate" } });
const rot = await cmd.next((m) => m.t === "code");
assert.notEqual(rot.code, sq.code);
const late = new Client("late");
assert.equal((await late.open(sq.room, { code: sq.code, callsign: "Late" })).code, "bad_code");

// end of game: marks become read-only
cmd.send({ t: "admin", opId: "a6", action: { a: "end" } });
await mort.next((m) => m.t === "ended");
mort.send({ t: "op", opId: "m2", op: { k: "move", id: "k3", x: 1, z: 1, u: null } });
assert.equal((await mort.next((m) => m.t === "reject")).reason, "ended");

// clean up: the commander deletes the squad, everybody is disconnected and the room is gone
cmd.send({ t: "admin", opId: "a7", action: { a: "delete" } });
assert.equal((await mort.next((m) => m.t === "error")).code, "gone");
const ghost = new Client("ghost");
await assert.rejects(() => ghost.open(sq.room, { code: rot.code, callsign: "Ghost" }));

for (const c of [cmd, mort, back]) c.close();
console.log("e2e: ok");
process.exit(0);
