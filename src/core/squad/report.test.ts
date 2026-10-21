import { describe, expect, it } from "vitest";
import { Room } from "./room";
import { PROTOCOL_VERSION as V, type ClientMsg, type MarkOp } from "./protocol";
import { REPORT_LIMITS, REPORT_SCHEMA, applyReportEdit, readReport, readReportEdit, reportStats, reportTimeline, type Report } from "./report";

const T0 = 1_700_000_000_000;

function game(): { room: Room; report: Report } {
  const room = Room.create({ joinHash: "h:c", memberId: "cmd", callsign: "Вовк", keyHash: "h:kc", now: T0, terrain: "everon" });
  let now = T0;
  const join = (id: string, name: string): void => {
    now += 1000;
    expect(room.hello({ joinHash: "h:c", callsign: name, keyHash: null, newMemberId: id, newKeyHash: "h:k" + id, now }).ok).toBe(true);
  };
  join("sol", "Alpha-2");
  join("mor", "Mortar 1");
  const send = (id: string, msg: ClientMsg): void => {
    now += 1000;
    room.handle(id, msg, now);
  };
  send("cmd", { t: "admin", v: V, opId: "r1", action: { a: "role", member: "mor", role: "mortarman" } });
  const op = (id: string, opId: string, o: MarkOp): void => send(id, { t: "op", v: V, opId, op: o });
  op("sol", "o1", { k: "create", id: "e1", aff: "hostile", kind: "armour", x: 100, z: 200, name: "Танк", caption: "міст", u: null, w: "" });
  op("sol", "o2", { k: "create", id: "e2", aff: "hostile", kind: "infantry", x: 110, z: 210, name: "", caption: "", u: 5, w: "" });
  op("mor", "o3", { k: "create", id: "f1", aff: "friend", kind: "mortar", x: 10, z: 20, name: "M1", caption: "", u: null, w: "M252" });
  op("sol", "o4", { k: "status", id: "e1", destroyed: true });
  op("cmd", "o5", { k: "delete", id: "e2" });
  send("mor", { t: "log", v: V, opId: "l1", entry: { id: "fe1", at: now, mortarName: "M1", targetName: "Танк", weapon: "M252", shell: "HE", charge: 2, elevation: 1200, bearingMils: 800, range: 1500, warnings: [{ name: "x", distance: 10, radius: 30 }] } });
  now += 1000;
  room.handle("cmd", { t: "admin", v: V, opId: "end", action: { a: "end" } }, now);
  return { room, report: room.state.report! };
}

describe("побудова звіту", () => {
  it("містить мітки з позивними авторів, журнал і учасників", () => {
    const { report } = game();
    expect(report.schema).toBe(REPORT_SCHEMA);
    expect(report.terrain).toBe("everon");
    expect(report.members.map((m) => `${m.callsign}:${m.role}`)).toEqual(["Вовк:commander", "Alpha-2:soldier", "Mortar 1:mortarman"]);
    const e1 = report.marks.find((m) => m.id === "e1")!;
    expect(e1).toMatchObject({ by: "Alpha-2", destroyed: true, kind: "armour", name: "Танк" });
    const e2 = report.marks.find((m) => m.id === "e2")!;
    expect(e2).toMatchObject({ deletedBy: "Вовк" });
    expect(e2.deletedAt).toBeGreaterThan(0);
    expect(report.fire).toHaveLength(1);
    expect(report.fire[0]).toMatchObject({ by: "Mortar 1", mortar: "M1", target: "Танк", shell: "HE", warnings: 1 });
  });

  it("підсумки: живі мітки за приналежністю й видом, знищені, видалені, по учасниках", () => {
    const st = reportStats(game().report);
    expect(st).toMatchObject({ total: 2, friend: 1, hostile: 1, destroyed: 1, deleted: 1, fireMissions: 1, warnings: 1 });
    expect(st.byKind.hostile.armour).toBe(1);
    expect(st.byKind.friend.mortar).toBe(1);
    const alpha = st.members.find((m) => m.callsign === "Alpha-2")!;
    expect(alpha).toMatchObject({ created: 1, hostile: 1, destroyed: 1 });
    expect(st.members.find((m) => m.callsign === "Mortar 1")).toMatchObject({ created: 1, friend: 1, fireMissions: 1 });
  });

  it("хронологія впорядкована за часом і містить усі види подій", () => {
    const tl = reportTimeline(game().report);
    const times = tl.map((e) => e.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    for (const type of ["joined", "mark", "updated", "deleted", "fire"]) expect(tl.some((e) => e.type === type)).toBe(true);
  });

  it("в звіт потрапляє не більше за ліміт міток", () => {
    const room = Room.create({ joinHash: "h", memberId: "cmd", callsign: "Вовк", keyHash: "k", now: T0 });
    let now = T0;
    for (let i = 0; i < 100; i++) {
      now += 2000;
      room.handle("cmd", { t: "op", v: V, opId: "c" + i, op: { k: "create", id: "k" + i, aff: "hostile", kind: "infantry", x: 1, z: 1, name: "", caption: "", u: null, w: "" } }, now);
    }
    for (let i = 0; i < 100; i++) {
      now += 2000;
      room.handle("cmd", { t: "op", v: V, opId: "d" + i, op: { k: "delete", id: "k" + i } }, now);
    }
    for (let i = 0; i < 100; i++) {
      now += 2000;
      room.handle("cmd", { t: "op", v: V, opId: "e" + i, op: { k: "create", id: "n" + i, aff: "hostile", kind: "infantry", x: 1, z: 1, name: "", caption: "", u: null, w: "" } }, now);
    }
    room.handle("cmd", { t: "admin", v: V, opId: "end", action: { a: "end" } }, now + 2000);
    expect(room.state.report!.marks.length).toBeLessThanOrEqual(REPORT_LIMITS.marks);
    expect(room.state.report!.marks.filter((m) => !m.deletedAt)).toHaveLength(100);
  });
});

describe("правки звіту", () => {
  it("заголовок, нотатки, мітка (назва, підпис, знищено, виключено); підсумки перераховуються", () => {
    let r = game().report;
    r = applyReportEdit(r, { k: "title", value: "  Бій   за міст " })!;
    expect(r.title).toBe("Бій за міст");
    r = applyReportEdit(r, { k: "notes", value: "Рядок 1\nРядок 2" })!;
    expect(r.notes).toBe("Рядок 1\nРядок 2");
    r = applyReportEdit(r, { k: "mark", id: "e1", name: "T-72", caption: "знищено", destroyed: false })!;
    expect(r.marks.find((m) => m.id === "e1")).toMatchObject({ name: "T-72", caption: "знищено", destroyed: false });
    expect(reportStats(r).destroyed).toBe(0);
    r = applyReportEdit(r, { k: "mark", id: "e1", excluded: true })!;
    expect(reportStats(r).total).toBe(1);
    expect(reportTimeline(r).some((e) => e.type === "mark" && e.mark.id === "e1")).toBe(false);
    r = applyReportEdit(r, { k: "mark", id: "e1", excluded: false })!;
    expect(reportStats(r).total).toBe(2);
  });

  it("недійсні правки відхиляються й не міняють звіт", () => {
    const r = game().report;
    expect(applyReportEdit(r, { k: "title", value: "x".repeat(REPORT_LIMITS.title + 1) })).toBeNull();
    expect(applyReportEdit(r, { k: "notes", value: "x".repeat(REPORT_LIMITS.notes + 1) })).toBeNull();
    expect(applyReportEdit(r, { k: "mark", id: "nope", name: "a" })).toBeNull();
    expect(applyReportEdit(r, { k: "mark", id: "e1", caption: "x".repeat(200) })).toBeNull();
    expect(readReportEdit({ k: "mark", id: "e1" })).toBeNull();
    expect(readReportEdit({ k: "mark", id: "bad id", name: "a" })).toBeNull();
    expect(readReportEdit({ k: "nope" })).toBeNull();
    expect(readReportEdit({ k: "title", value: 5 })).toBeNull();
  });
});

describe("читання файлу", () => {
  it("експортований звіт читається назад без втрат", () => {
    const r = applyReportEdit(game().report, { k: "title", value: "Тест" })!;
    expect(readReport(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });
  it("чужа схема й сміття відкидаються, зайве обрізається", () => {
    expect(readReport(null)).toBeNull();
    expect(readReport({ schema: "other/1", members: [], marks: [], fire: [] })).toBeNull();
    const r = game().report;
    const dirty = JSON.parse(JSON.stringify({ ...r, title: "x".repeat(500), marks: [...r.marks, { aff: "alien", kind: "x" }, 5] }));
    const back = readReport(dirty)!;
    expect(back.title.length).toBe(REPORT_LIMITS.title);
    expect(back.marks).toHaveLength(r.marks.length);
  });
});
