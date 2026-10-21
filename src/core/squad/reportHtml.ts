/**
 * Звіт у вигляді самодостатньої сторінки HTML (для друку або «зберегти як PDF»). Мова — та, яку передано функцією `tr`
 * (мова застосунку). Усе введене користувачем екранується; сторінка без скриптів і без зовнішніх ресурсів.
 */
import { gridRef } from "../geometry";
import type { Report, ReportMark, TimelineEvent } from "./report";
import { reportStats, reportTimeline } from "./report";
import type { Role, SquadKind } from "./protocol";

export type ReportKey =
  | "repDefaultTitle" | "repTerrain" | "repPeriod" | "repTotals" | "repLive" | "repDestroyed" | "repDeleted" | "repFire" | "repWarnings"
  | "repMembers" | "repColCallsign" | "repColRole" | "repColMarks" | "repColHostile" | "repColFriend" | "repColDestroyed" | "repColFire"
  | "repMarks" | "repColMark" | "repColKind" | "repColGrid" | "repColAuthor" | "repColTime" | "repColState"
  | "repStateDestroyed" | "repStateDeleted" | "repStateOk" | "repRemoved"
  | "repFireTitle" | "repColMortar" | "repColTarget" | "repColShell" | "repColAzimuth" | "repColElevation" | "repColRange"
  | "repTimeline" | "repEvJoined" | "repEvMark" | "repEvUpdated" | "repEvDeleted" | "repEvFire" | "repNotes" | "repFooter"
  | "affFriend" | "affHostile" | "kindInfantry" | "kindArmour" | "kindMortar" | "kindHelicopter" | "kindRetreat"
  | "roleCommander" | "roleMortarman" | "roleSoldier";

export type Tr = (key: ReportKey, vars?: Record<string, string | number>) => string;

export interface ReportLocale {
  lang: string;
  /** Назва терену за його id. */
  terrainName: (id: string) => string;
}

const KIND_KEY: Record<SquadKind, ReportKey> = { infantry: "kindInfantry", armour: "kindArmour", mortar: "kindMortar", helicopter: "kindHelicopter", retreat: "kindRetreat" };
const ROLE_KEY: Record<Role, ReportKey> = { commander: "roleCommander", mortarman: "roleMortarman", soldier: "roleSoldier" };

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function markLabel(m: ReportMark, tr: Tr): string {
  return m.name || tr(KIND_KEY[m.kind]);
}

/** Текст однієї події хронології. */
export function eventText(e: TimelineEvent, tr: Tr): string {
  switch (e.type) {
    case "joined":
      return tr("repEvJoined", { who: e.who });
    case "mark":
      return tr("repEvMark", { who: e.who, what: markLabel(e.mark, tr), aff: tr(e.mark.aff === "friend" ? "affFriend" : "affHostile"), grid: gridRef(e.mark.x, e.mark.z) });
    case "updated":
      return tr("repEvUpdated", { who: e.who, what: markLabel(e.mark, tr) });
    case "deleted":
      return tr("repEvDeleted", { who: e.who, what: markLabel(e.mark, tr) });
    case "fire":
      return tr("repEvFire", { who: e.who, mortar: e.fire.mortar, target: e.fire.target });
  }
}

export function reportHtml(r: Report, tr: Tr, loc: ReportLocale): string {
  const time = (ms: number): string => new Date(ms).toLocaleString(loc.lang);
  const st = reportStats(r);
  const title = r.title || tr("repDefaultTitle");
  const row = (cells: Array<string | number>, tag = "td"): string => `<tr>${cells.map((c) => `<${tag}>${esc(String(c))}</${tag}>`).join("")}</tr>`;
  const table = (head: ReportKey[], rows: string[]): string => `<table><thead>${row(head.map((h) => tr(h)), "th")}</thead><tbody>${rows.join("")}</tbody></table>`;

  const kinds = (["infantry", "armour", "mortar", "helicopter", "retreat"] as SquadKind[])
    .map((k) => `<li>${esc(tr(KIND_KEY[k]))}: ${esc(tr("affFriend"))} ${st.byKind.friend[k]}, ${esc(tr("affHostile"))} ${st.byKind.hostile[k]}</li>`)
    .join("");

  const members = table(
    ["repColCallsign", "repColRole", "repColMarks", "repColHostile", "repColFriend", "repColDestroyed", "repColFire"],
    st.members.map((m) => row([m.callsign + (m.removed ? ` (${tr("repRemoved")})` : ""), tr(ROLE_KEY[m.role]), m.created, m.hostile, m.friend, m.destroyed, m.fireMissions]))
  );

  const marks = table(
    ["repColMark", "repColKind", "repColGrid", "repColAuthor", "repColTime", "repColState"],
    r.marks
      .filter((m) => !m.excluded)
      .map((m) => {
        const state = m.deletedAt ? tr("repStateDeleted") : m.destroyed ? tr("repStateDestroyed") : tr("repStateOk");
        const name = markLabel(m, tr) + (m.caption ? ` — ${m.caption}` : "");
        return row([name, `${tr(m.aff === "friend" ? "affFriend" : "affHostile")}, ${tr(KIND_KEY[m.kind])}`, gridRef(m.x, m.z), m.by, time(m.at), state]);
      })
  );

  const fire = r.fire.length
    ? table(
        ["repColTime", "repColAuthor", "repColMortar", "repColTarget", "repColShell", "repColAzimuth", "repColElevation", "repColRange"],
        r.fire.map((f) => row([time(f.at), f.by, f.mortar, f.target, `${f.shell} / ${f.charge}`, Math.round(f.bearingMils), Math.round(f.elevation), `${Math.round(f.range)}`]))
      )
    : "";

  const timeline = reportTimeline(r)
    .map((e) => `<li><time>${esc(time(e.at))}</time> ${esc(eventText(e, tr))}</li>`)
    .join("");

  return `<!doctype html>
<html lang="${esc(loc.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
body{font:14px/1.45 system-ui,Segoe UI,Roboto,sans-serif;color:#1c2420;margin:24px auto;max-width:960px;padding:0 16px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:26px 0 8px;border-bottom:1px solid #c9d3cc;padding-bottom:4px}
.meta{color:#55635a}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #c9d3cc;padding:4px 8px;text-align:left;vertical-align:top}
th{background:#eef2ef}ul{padding-left:20px}time{color:#55635a;margin-right:6px}.notes{white-space:pre-wrap}footer{margin-top:30px;color:#77857c;font-size:12px}
@media print{body{margin:0}h2{break-after:avoid}tr{break-inside:avoid}}
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<div class="meta">${esc(tr("repTerrain"))}: ${esc(loc.terrainName(r.terrain) || r.terrain)} · ${esc(tr("repPeriod"))}: ${esc(time(r.startedAt))} – ${esc(time(r.endedAt))}</div>
<h2>${esc(tr("repTotals"))}</h2>
<ul>
<li>${esc(tr("repLive"))}: ${st.total} (${esc(tr("affFriend"))} ${st.friend}, ${esc(tr("affHostile"))} ${st.hostile})</li>
<li>${esc(tr("repDestroyed"))}: ${st.destroyed}</li>
<li>${esc(tr("repDeleted"))}: ${st.deleted}</li>
<li>${esc(tr("repFire"))}: ${st.fireMissions}${st.warnings ? `, ${esc(tr("repWarnings"))}: ${st.warnings}` : ""}</li>
${kinds}
</ul>
${r.notes ? `<h2>${esc(tr("repNotes"))}</h2><div class="notes">${esc(r.notes)}</div>` : ""}
<h2>${esc(tr("repMembers"))}</h2>
${members}
<h2>${esc(tr("repMarks"))}</h2>
${marks}
${fire ? `<h2>${esc(tr("repFireTitle"))}</h2>${fire}` : ""}
<h2>${esc(tr("repTimeline"))}</h2>
<ul>${timeline}</ul>
<footer>${esc(tr("repFooter"))}</footer>
</body>
</html>
`;
}
