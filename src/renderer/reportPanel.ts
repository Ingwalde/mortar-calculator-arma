/**
 * Звіт про гру у вкладці «Відділення»: перегляд, правка (командир і ті, кому дозволено), збереження у файл (JSON і HTML для
 * друку) та відкриття збереженого звіту. Збереження звіту командиром чи редактором і є сигналом серверу забути відділення.
 */
import { gridRef } from "@core/geometry";
import { reportHtml, eventText, markLabel, type ReportKey, type Tr } from "@core/squad/reportHtml";
import { reportStats, reportTimeline, REPORT_LIMITS, type Report } from "@core/squad/report";
import { findPreset } from "@core/terrains";
import { LIMITS } from "@core/squad/protocol";
import { ask, toast } from "./dom";
import { getLang, t } from "./i18n";
import { closeReport, editReport, openReportText, reportExported, reportInfo, squadInfo } from "./squad";
import { getRoot } from "./state";

const tr: Tr = (key: ReportKey, vars) => t(key, vars);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function button(label: string, onClick: () => void, cls = "btn"): HTMLButtonElement {
  const b = el("button", cls, label);
  b.type = "button";
  b.onclick = onClick;
  return b;
}

function terrainName(id: string): string {
  return findPreset(id)?.name ?? getRoot().customTerrains.find((c) => c.id === id)?.name ?? "";
}

function stamp(r: Report): string {
  const d = new Date(r.endedAt);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Зберігає файл звіту; якщо звіт живий (відділення ще є) — після збереження просить сервер видалити відділення. */
async function save(r: Report, kind: "json" | "html"): Promise<void> {
  const live = reportInfo.editable;
  if (live) {
    const ok = await ask(t("repAskTitle"), t("repAskText"), t("repAskYes"));
    if (!ok) return;
  }
  if (kind === "json") download(`squad-report-${stamp(r)}.json`, JSON.stringify(r, null, 1), "application/json");
  else download(`squad-report-${stamp(r)}.html`, reportHtml(r, tr, { lang: getLang(), terrainName }), "text/html");
  if (live) reportExported();
  else toast(t("exSaved", { f: `squad-report-${stamp(r)}.${kind}` }));
}

function pickFile(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = () => {
    const f = input.files?.[0];
    if (!f) return;
    void f.text().then((text) => {
      if (!openReportText(text)) toast(t("repBadFile"), 3500);
    });
  };
  input.click();
}

export function openFileButton(): HTMLButtonElement {
  return button(t("repOpenFile"), pickFile);
}

function field(id: string, label: string, value: string, max: number, onChange: (v: string) => void, area = false): HTMLElement {
  const wrap = el("div", "field");
  const l = el("label", "", label);
  const input = area ? el("textarea") : el("input");
  input.id = id;
  input.value = value;
  input.maxLength = max;
  if (area) (input as HTMLTextAreaElement).rows = 4;
  l.htmlFor = id;
  input.onchange = () => onChange(input.value);
  wrap.append(l, input);
  return wrap;
}

function line(label: string): HTMLElement {
  return el("div", "rep-line", label);
}

/** Малює звіт у контейнер. */
export function renderReport(root: HTMLElement): void {
  const r = reportInfo.report;
  if (!r) return;
  const editable = reportInfo.editable;
  const st = reportStats(r);
  const box = el("section", "squad-block rep");
  box.appendChild(el("h3", "", t("repHeading")));
  box.appendChild(el("p", "hint small", editable ? t("repEditHint") : squadInfo.session ? t("repReadOnly") : t("repFileHint")));

  if (editable) box.appendChild(field("rep-title", t("repTitleLabel"), r.title, REPORT_LIMITS.title, (v) => editReport({ k: "title", value: v })));
  else box.appendChild(el("p", "rep-title", r.title || t("repDefaultTitle")));

  const when = (ms: number): string => new Date(ms).toLocaleString(getLang());
  box.appendChild(line(`${t("repTerrain")}: ${terrainName(r.terrain) || r.terrain} · ${when(r.startedAt)} – ${when(r.endedAt)}`));
  box.appendChild(line(`${t("repLive")}: ${st.total} (${t("affFriend")} ${st.friend}, ${t("affHostile")} ${st.hostile})`));
  box.appendChild(line(`${t("repDestroyed")}: ${st.destroyed} · ${t("repDeleted")}: ${st.deleted}`));
  box.appendChild(line(`${t("repFire")}: ${st.fireMissions}${st.warnings ? `, ${t("repWarnings")}: ${st.warnings}` : ""}`));

  // учасники
  const members = el("table", "rep-table");
  const head = el("tr");
  for (const k of ["repColCallsign", "repColRole", "repColMarks", "repColHostile", "repColFriend", "repColDestroyed", "repColFire"] as ReportKey[]) head.appendChild(el("th", "", t(k)));
  members.appendChild(head);
  for (const m of st.members) {
    const tr_ = el("tr");
    const role = t(m.role === "commander" ? "roleCommander" : m.role === "mortarman" ? "roleMortarman" : "roleSoldier");
    for (const c of [m.callsign + (m.removed ? ` (${t("repRemoved")})` : ""), role, m.created, m.hostile, m.friend, m.destroyed, m.fireMissions]) tr_.appendChild(el("td", "", String(c)));
    members.appendChild(tr_);
  }
  box.appendChild(members);

  // мітки
  const marks = el("details");
  marks.appendChild(el("summary", "", t("repShowMarks", { n: r.marks.length })));
  for (const m of r.marks) {
    const row = el("div", "rep-mark" + (m.deletedAt ? " gone" : ""));
    const label = `${markLabel(m, tr)} · ${t(m.aff === "friend" ? "affFriend" : "affHostile")} · ${gridRef(m.x, m.z)} · ${m.by}, ${when(m.at)}${m.deletedAt ? ` · ${t("repStateDeleted")}` : ""}`;
    row.appendChild(el("div", "rep-mark-head", label));
    if (editable) {
      const id = "rep-m-" + m.id;
      const controls = el("div", "rep-mark-edit");
      controls.append(
        field(id + "-n", t("repMarkName"), m.name, LIMITS.markName, (v) => editReport({ k: "mark", id: m.id, name: v })),
        field(id + "-c", t("repMarkCaption"), m.caption, LIMITS.caption, (v) => editReport({ k: "mark", id: m.id, caption: v }))
      );
      const toggles = el("div", "rep-toggles");
      for (const [key, label2, checked] of [["destroyed", t("repMarkDestroyed"), m.destroyed], ["excluded", t("repMarkExclude"), !!m.excluded]] as const) {
        const l = el("label", "check");
        const cb = el("input");
        cb.type = "checkbox";
        cb.checked = checked;
        cb.onchange = () => editReport({ k: "mark", id: m.id, [key]: cb.checked });
        l.append(cb, document.createTextNode(" " + label2));
        toggles.appendChild(l);
      }
      controls.appendChild(toggles);
      row.appendChild(controls);
    } else if (m.caption) row.appendChild(el("div", "cap", m.caption));
    marks.appendChild(row);
  }
  box.appendChild(marks);

  if (r.fire.length) {
    const fire = el("details");
    fire.appendChild(el("summary", "", t("repShowFire", { n: r.fire.length })));
    for (const f of r.fire) fire.appendChild(el("div", "rep-line", `${when(f.at)} · ${f.by}: ${f.mortar} → ${f.target} · ${f.shell}/${f.charge} · ${Math.round(f.bearingMils)} / ${Math.round(f.elevation)} · ${Math.round(f.range)} м`));
    box.appendChild(fire);
  }

  const events = reportTimeline(r);
  const tl = el("details");
  tl.appendChild(el("summary", "", t("repShowTimeline", { n: events.length })));
  for (const e of events) tl.appendChild(el("div", "rep-line", `${when(e.at)} · ${eventText(e, tr)}`));
  box.appendChild(tl);

  if (editable) box.appendChild(field("rep-notes", t("repNotesLabel"), r.notes, REPORT_LIMITS.notes, (v) => editReport({ k: "notes", value: v }), true));
  else if (r.notes) box.appendChild(el("p", "rep-notes", r.notes));

  const row = el("div", "row");
  row.append(button(t("repSaveJson"), () => void save(r, "json"), "btn primary"), button(t("repSavePrint"), () => void save(r, "html")));
  if (!squadInfo.session) row.appendChild(button(t("repClose"), closeReport, "btn danger"));
  box.appendChild(row);
  root.appendChild(box);
}
