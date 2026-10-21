import { describe, expect, it } from "vitest";
import { LIMITS, PROTOCOL_VERSION, callsignKey, parseClientMessage, readCallsign } from "./protocol";

const V = PROTOCOL_VERSION;
const parse = (o: unknown) => parseClientMessage(JSON.stringify(o));

describe("parseClientMessage", () => {
  it("приймає коректні повідомлення", () => {
    expect(parse({ t: "ping", v: V })).toEqual({ ok: true, msg: { t: "ping", v: V } });
    const create = { t: "op", v: V, opId: "o1", op: { k: "create", id: "m1", aff: "hostile", kind: "armour", x: 100, z: 200, name: "Танк", caption: "біля мосту", u: 12, w: "" } };
    expect(parse(create)).toEqual({ ok: true, msg: create });
    expect(parse({ t: "admin", v: V, opId: "a1", action: { a: "role", member: "m2", role: "mortarman" } }).ok).toBe(true);
    expect(parse({ t: "admin", v: V, opId: "a2", action: { a: "terrain", id: "everon" } }).ok).toBe(true);
    expect(parse({ t: "admin", v: V, opId: "a3", action: { a: "terrain", id: "bad id" } }).ok).toBe(false);
    expect(parse({ t: "op", v: V, opId: "o2", op: { k: "create", id: "m", aff: "friend", kind: "mortar", x: 1, z: 1, name: "", caption: "", u: null, w: "M252" } }).ok).toBe(true);
    expect(parse({ t: "op", v: V, opId: "o3", op: { k: "edit", id: "m", w: "bad weapon!" } }).ok).toBe(false);
  });

  it("відкидає не JSON, чужу версію, невідомий тип і неправильні поля", () => {
    expect(parseClientMessage("{").ok).toBe(false);
    expect(parseClientMessage(5)).toEqual({ ok: false, code: "invalid" });
    expect(parse({ t: "ping", v: 99 })).toEqual({ ok: false, code: "version" });
    expect(parse({ t: "nope", v: V }).ok).toBe(false);
    expect(parse({ t: "op", v: V, opId: "o1", op: { k: "create", id: "m1", aff: "neutral", kind: "armour", x: 1, z: 1 } }).ok).toBe(false);
    expect(parse({ t: "op", v: V, opId: "o1", op: { k: "create", id: "m1", aff: "friend", kind: "legacy", x: 1, z: 1 } }).ok).toBe(false);
    expect(parse({ t: "op", v: V, opId: "o1", op: { k: "move", id: "m1", x: Infinity, z: 1 } }).ok).toBe(false);
    expect(parse({ t: "op", v: V, opId: "o1", op: { k: "move", id: "m1", x: 1e9, z: 1 } }).ok).toBe(false);
    expect(parse({ t: "op", v: V, opId: "bad id!", op: { k: "delete", id: "m1" } }).ok).toBe(false);
    expect(parse({ t: "op", v: V, opId: "o1", op: { k: "edit", id: "m1" } }).ok).toBe(false);
  });

  it("підпис довший за ліміт відкидається, керівні символи прибираються", () => {
    expect(parse({ t: "op", v: V, opId: "o", op: { k: "caption", id: "m", caption: "x".repeat(LIMITS.caption + 1) } }).ok).toBe(false);
    const r = parse({ t: "op", v: V, opId: "o", op: { k: "caption", id: "m", caption: "  a\u0000b\n c " } });
    expect(r.ok && r.msg.t === "op" && r.msg.op.k === "caption" && r.msg.op.caption).toBe("a b c");
  });

  it("повідомлення більше 8 КБ (у байтах) відкидається", () => {
    const big = { t: "log", v: V, opId: "o", entry: { id: "e", at: 1, note: "ї".repeat(5000) } };
    expect(parse(big)).toEqual({ ok: false, code: "invalid" });
  });
});

describe("позивні", () => {
  it("правила довжини й символів", () => {
    expect(readCallsign("Alpha-2")).toBe("Alpha-2");
    expect(readCallsign("  Вовк  ")).toBe("Вовк");
    expect(readCallsign("A")).toBeNull();
    expect(readCallsign("a".repeat(17))).toBeNull();
    expect(readCallsign("Alpha<2>")).toBeNull();
    expect(readCallsign(7)).toBeNull();
  });
  it("схожі позивні мають однаковий ключ", () => {
    expect(callsignKey("Alpha-2")).toBe(callsignKey("alpha 2"));
    expect(callsignKey("ALPHA_2")).toBe(callsignKey("Alpha2"));
    expect(callsignKey("Alpha-2")).not.toBe(callsignKey("Alpha-3"));
  });
});
