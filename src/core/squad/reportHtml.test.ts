import { describe, expect, it } from "vitest";
import { REPORT_SCHEMA, type Report } from "./report";
import { esc, eventText, reportHtml, type ReportKey, type Tr } from "./reportHtml";

// «переклад» для тесту: ключ і підставлені значення — видно, що саме потрапило в сторінку
const tr: Tr = (k: ReportKey, v) => (v ? `${k}(${Object.values(v).join(",")})` : k);

const report: Report = {
  schema: REPORT_SCHEMA,
  title: "Бій <b>за</b> міст",
  notes: "Рядок 1\n<script>alert(1)</script>",
  terrain: "everon",
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_003_600_000,
  members: [
    { id: "a", callsign: "Вовк", role: "commander", removed: false, joinedAt: 1_700_000_000_000 },
    { id: "b", callsign: "Alpha-2", role: "soldier", removed: true, joinedAt: 1_700_000_100_000 }
  ],
  marks: [
    { id: "m1", aff: "hostile", kind: "armour", name: "Танк \"T-72\"", caption: "<img src=x onerror=alert(1)>", x: 5200, z: 6100, h: null, w: "", destroyed: true, by: "Alpha-2", at: 1_700_000_200_000, ub: "Alpha-2", ut: 1_700_000_300_000 },
    { id: "m2", aff: "friend", kind: "mortar", name: "", caption: "", x: 100, z: 200, h: 5, w: "M252", destroyed: false, by: "Вовк", at: 1_700_000_150_000, ub: "Вовк", ut: 1_700_000_150_000 }
  ],
  fire: [{ id: "f1", at: 1_700_000_400_000, by: "Вовк", mortar: "M1", target: "Танк", weapon: "M252", shell: "HE", charge: 2, elevation: 1180, bearingMils: 800, range: 1500, warnings: 0 }]
};

const html = reportHtml(report, tr, { lang: "uk", terrainName: (id) => (id === "everon" ? "Everon" : "") });

describe("HTML звіту", () => {
  it("екранує все введене користувачем: ні тегів, ні атрибутів-обробників", () => {
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>за</b>");
    expect(html).toContain("&lt;b&gt;за&lt;/b&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("Танк &quot;T-72&quot;");
  });
  it("не містить скриптів і зовнішніх ресурсів", () => {
    expect(html).not.toMatch(/<(script|link|img|iframe|object|embed)/i);
    expect(html).not.toMatch(/<[^>]*\son\w+=/i);
    expect(html).not.toMatch(/https?:\/\//i);
  });
  it("містить підсумки, учасників, мітки, журнал і хронологію", () => {
    for (const s of ["repTotals", "repMembers", "repMarks", "repFireTitle", "repTimeline", "Alpha-2", "Everon", "0520 0610", "repStateDestroyed"]) expect(html).toContain(s);
    expect(html).toContain("repRemoved");
  });
  it("без журналу стрільби розділ не виводиться; без заголовка береться типовий", () => {
    const h = reportHtml({ ...report, title: "", fire: [], notes: "" }, tr, { lang: "uk", terrainName: () => "" });
    expect(h).not.toContain("repFireTitle");
    expect(h).not.toContain("repNotes");
    expect(h).toContain("<title>repDefaultTitle</title>");
  });
  it("esc та текст події", () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    expect(eventText({ at: 1, who: "Вовк", type: "joined" }, tr)).toBe("repEvJoined(Вовк)");
  });
});
