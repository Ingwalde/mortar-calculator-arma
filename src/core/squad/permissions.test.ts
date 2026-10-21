import { describe, expect, it } from "vitest";
import { canAdmin, canCaption, canCreate, canDelete, canEdit, canEditReport, canMove, canSetStatus, canUseSolution } from "./permissions";
import type { Role } from "./protocol";

const roles: Role[] = ["commander", "mortarman", "soldier"];

describe("матриця прав (docs/squad-mode.md, розділ 4)", () => {
  // [дія, командир, мінометник, солдат]
  const rows: [string, (r: Role) => boolean, boolean, boolean, boolean][] = [
    ["створити свою піхоту", (r) => canCreate(r, "friend", "infantry"), true, true, true],
    ["створити ворожу броню", (r) => canCreate(r, "hostile", "armour"), true, true, true],
    ["створити гелікоптер і відступ", (r) => canCreate(r, "hostile", "helicopter") && canCreate(r, "friend", "retreat"), true, true, true],
    ["створити свій міномет", (r) => canCreate(r, "friend", "mortar"), true, true, false],
    ["створити ворожий міномет (позиція ворога)", (r) => canCreate(r, "hostile", "mortar"), true, true, true],
    ["пересунути мітку", canMove, true, true, true],
    ["змінити чужу мітку", (r) => canEdit(r, { aff: "hostile", kind: "infantry", own: false }), true, true, false],
    ["змінити свою мітку", (r) => canEdit(r, { aff: "hostile", kind: "infantry", own: true }), true, true, true],
    ["видалити чужу мітку", (r) => canDelete(r, { aff: "friend", kind: "infantry", own: false }), true, true, false],
    ["видалити свою мітку", (r) => canDelete(r, { aff: "friend", kind: "infantry", own: true }), true, true, true],
    ["підпис до чужої своєї мітки", (r) => canCaption(r, { aff: "friend", kind: "infantry", own: false }), true, true, false],
    ["підпис до чужої ворожої мітки", (r) => canCaption(r, { aff: "hostile", kind: "infantry", own: false }), true, true, true],
    ["підпис до своєї мітки", (r) => canCaption(r, { aff: "friend", kind: "infantry", own: true }), true, true, true],
    ["позначити зруйнованим", canSetStatus, true, true, true],
    ["розрахунок і журнал", canUseSolution, true, true, false],
    ["керування відділенням", canAdmin, true, false, false]
  ];
  for (const [name, fn, c, m, s] of rows) {
    it(name, () => {
      expect(roles.map(fn)).toEqual([c, m, s]);
    });
  }

  it("редагувати звіт: командир завжди, інші лише з дозволом", () => {
    expect(canEditReport("commander", false)).toBe(true);
    expect(canEditReport("mortarman", false)).toBe(false);
    expect(canEditReport("mortarman", true)).toBe(true);
    expect(canEditReport("soldier", true)).toBe(true);
    expect(canEditReport("soldier", false)).toBe(false);
  });
});
