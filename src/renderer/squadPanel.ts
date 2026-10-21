/**
 * Вкладка «Відділення»: створити відділення або приєднатися, запросити, список учасників і керування командира.
 * Усе показане тут — лише вигляд: права на дії перевіряє сервер.
 */
import { parseInvite, type Invite } from "@core/squad/config";
import type { MemberInfo, Role } from "@core/squad/protocol";
import { ask, toast } from "./dom";
import { getRoot, currentMeta } from "./state";
import { findPreset } from "@core/terrains";
import { onLangChange, t } from "./i18n";
import { createSquad, joinSquad, leaveSquad, onSquadChange, resumeSquad, retrySquad, sendAdmin, shareLocalMarks, squadInfo, type JoinError } from "./squad";
import { switchTerrain } from "./state";
import { openFileButton, renderReport } from "./reportPanel";

const CALLSIGN_KEY = "mortar.callsign";

let busy = false;
let message = "";
let invitePrefill = "";
let qrFor = "";
let qrUrl = "";
let showTab: (() => void) | null = null;
let afterTerrainSwitch: (() => void) | null = null;

function remembered(): string {
  try {
    return localStorage.getItem(CALLSIGN_KEY) ?? "";
  } catch {
    return "";
  }
}

function remember(v: string): void {
  try {
    localStorage.setItem(CALLSIGN_KEY, v);
  } catch {
    /* не страшно */
  }
}

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

function roleName(r: Role): string {
  return t(r === "commander" ? "roleCommander" : r === "mortarman" ? "roleMortarman" : "roleSoldier");
}

function terrainName(id: string): string {
  const p = findPreset(id);
  if (p) return p.name;
  return getRoot().customTerrains.find((c) => c.id === id)?.name ?? "";
}

function errorText(e: JoinError): string {
  const keys: Record<JoinError, Parameters<typeof t>[0]> = {
    limit: "squadErrLimit",
    disabled: "squadErrDisabled",
    bad_code: "squadErrBadCode",
    bad_callsign: "squadErrBadCallsign",
    callsign_taken: "squadErrTaken",
    full: "squadErrFull",
    removed: "squadErrRemoved",
    ended: "squadErrEnded",
    gone: "squadErrGone",
    network: "squadErrNetwork",
    version: "squadVersion",
    invalid: "squadErrNetwork"
  };
  return t(keys[e]);
}

// ---------- без відділення ----------

function renderStart(root: HTMLElement): void {
  root.appendChild(el("p", "hint", t("squadIntro")));
  const field = el("div", "field");
  const label = el("label", "", t("squadCallsign"));
  const callsign = el("input");
  callsign.id = "squadCallsign";
  callsign.maxLength = 16;
  callsign.autocomplete = "off";
  callsign.value = remembered();
  label.htmlFor = callsign.id;
  field.append(label, callsign, el("div", "hint small", t("squadCallsignHint")));
  root.appendChild(field);

  const create = button(t("squadCreateBtn"), () => void run(() => createSquad(callsign.value.trim()), callsign.value), "btn primary");
  create.disabled = busy;
  root.append(el("div", "row squad-row", ""), el("p", "hint small", t("squadCreateHint", { terrain: currentMeta().name })));
  root.querySelector(".squad-row")!.appendChild(create);

  const jf = el("div", "field");
  jf.style.marginTop = "16px";
  const jl = el("label", "", t("squadJoinLabel"));
  const invite = el("input");
  invite.id = "squadInvite";
  invite.autocomplete = "off";
  invite.value = invitePrefill;
  jl.htmlFor = invite.id;
  jf.append(jl, invite);
  const join = button(t("squadJoinBtn"), () => {
    const inv = parseInvite(invite.value);
    if (!inv) {
      message = t("squadErrInvite");
      render();
      return;
    }
    void run(() => joinSquad(inv, callsign.value.trim()), callsign.value);
  });
  join.disabled = busy;
  const jr = el("div", "row");
  jr.appendChild(join);
  root.append(jf, jr);
  if (message) root.appendChild(el("p", "squad-msg", message));
  const file = el("div", "row");
  file.style.marginTop = "16px";
  file.appendChild(openFileButton());
  root.appendChild(file);
}

async function run(action: () => Promise<JoinError | null>, callsign: string): Promise<void> {
  busy = true;
  message = t("squadWorking");
  render();
  const err = await action();
  busy = false;
  if (err) message = errorText(err);
  else {
    message = "";
    invitePrefill = "";
    remember(callsign.trim());
  }
  render();
}

// ---------- у відділенні ----------

function statusLine(): HTMLElement {
  const box = el("div", "squad-status");
  const link = squadInfo.link;
  const dot = el("span", "dot " + link);
  box.append(dot, el("span", "", squadInfo.removed ? "" : t(link === "online" ? "squadLinkOnline" : link === "connecting" ? "squadLinkConnecting" : "squadLinkOffline")));
  if (squadInfo.pending) box.appendChild(el("span", "squad-pending", t("squadPending", { n: squadInfo.pending })));
  return box;
}

async function qrImage(url: string): Promise<string> {
  if (qrFor === url) return qrUrl;
  const QRCode = (await import("qrcode")).default;
  qrUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "L", margin: 2, width: 240 });
  qrFor = url;
  return qrUrl;
}

function memberRow(m: MemberInfo, commander: boolean, me: string): HTMLElement {
  const li = el("li", "squad-member");
  const dot = el("span", "dot " + (m.online ? "online" : "offline"));
  dot.title = m.online ? t("squadOnlineDot") : "";
  const name = el("span", "squad-name", m.callsign + (m.id === me ? ` (${t("squadYouLabel")})` : ""));
  li.append(dot, name);
  if (commander && m.id !== me && !m.removed && squadInfo.phase === "ended") {
    // після кінця гри ролі вже не міняються: командир лише дозволяє правити звіт
    li.appendChild(el("span", "badge", roleName(m.role)));
    const l = el("label", "check");
    const cb = el("input");
    cb.type = "checkbox";
    cb.checked = m.editor;
    cb.onchange = () => sendAdmin({ a: "editor", member: m.id, allowed: cb.checked });
    l.append(cb, document.createTextNode(" " + t("squadEditorToggle")));
    li.appendChild(l);
  } else if (commander && m.id !== me && !m.removed) {
    const sel = el("select");
    sel.setAttribute("aria-label", t("squadMembers", { n: "" }));
    for (const r of ["soldier", "mortarman", "commander"] as Role[]) sel.add(new Option(roleName(r), r, false, r === m.role));
    sel.onchange = () => {
      const role = sel.value as Role;
      if (role === "commander") {
        void ask(t("squadHandoverTitle", { name: m.callsign }), t("squadHandoverText")).then((ok) => {
          if (ok) sendAdmin({ a: "role", member: m.id, role });
          else sel.value = m.role;
        });
      } else sendAdmin({ a: "role", member: m.id, role });
    };
    li.appendChild(sel);
    li.appendChild(
      button(t("squadRemoveBtn"), () => {
        void ask(t("squadRemoveTitle", { name: m.callsign }), t("squadRemoveText"), t("squadRemoveBtn")).then((ok) => {
          if (ok) sendAdmin({ a: "remove", member: m.id });
        });
      }, "btn small danger")
    );
  } else if (m.removed) {
    li.appendChild(button(t("squadRestoreBtn"), () => sendAdmin({ a: "restore", member: m.id }), "btn small"));
  } else {
    li.appendChild(el("span", "badge", roleName(m.role)));
  }
  return li;
}

function renderIn(root: HTMLElement): void {
  const s = squadInfo.session!;
  const role = squadInfo.role;
  const commander = role === "commander";
  root.appendChild(statusLine());
  if (squadInfo.removed) {
    root.appendChild(el("p", "squad-msg", t("squadRemovedBanner")));
    root.appendChild(button(t("squadRetryBtn"), retrySquad));
  }
  if (squadInfo.phase === "ended") root.appendChild(el("p", "squad-msg", t("squadEndedBanner")));
  if (role) root.appendChild(el("p", "squad-you", t("squadYouAre", { role: roleName(role), name: s.callsign })));
  if (role === "soldier") root.appendChild(el("p", "hint small", t("squadSoldierHint")));

  // карта відділення
  if (s.terrain) {
    const known = !!terrainName(s.terrain);
    const line = el("p", "squad-map", t("squadMapLine", { terrain: terrainName(s.terrain) || s.terrain }) + (known ? "" : " " + t("squadMapUnknown")));
    root.appendChild(line);
    if (known && s.terrain !== getRoot().cur) {
      root.appendChild(
        button(t("squadMapSwitch"), () => {
          switchTerrain(s.terrain);
          afterTerrainSwitch?.();
          render();
        })
      );
    }
  }
  root.appendChild(el("p", "hint small", t("squadLocalHint")));

  // запрошення
  const link = squadInfo.link_;
  const inv = el("section", "squad-block");
  inv.appendChild(el("h3", "", t("squadInviteTitle")));
  if (link) {
    const box = el("input");
    box.readOnly = true;
    box.value = link;
    box.onfocus = () => box.select();
    const row = el("div", "row");
    row.appendChild(
      button(t("squadInviteCopy"), () => {
        void navigator.clipboard
          .writeText(link)
          .then(() => toast(t("copied")))
          .catch(() => box.select());
      })
    );
    if (typeof navigator.share === "function") row.appendChild(button(t("squadInviteShare"), () => void navigator.share({ url: link }).catch(() => undefined)));
    inv.append(box, row);
    const img = el("img", "squad-qr");
    img.alt = "QR";
    img.width = 160;
    img.height = 160;
    img.hidden = true;
    inv.appendChild(img);
    void qrImage(link).then((src) => {
      img.src = src;
      img.hidden = false;
    });
  } else inv.appendChild(el("p", "hint small", t("squadInviteHidden")));
  if (commander) {
    inv.appendChild(
      button(t("squadInviteRotate"), () => {
        sendAdmin({ a: "rotate" });
        toast(t("squadInviteRotated"));
      })
    );
  }
  root.appendChild(inv);

  // учасники
  const list = squadInfo.members;
  const active = list.filter((m) => !m.removed);
  const removed = list.filter((m) => m.removed);
  const block = el("section", "squad-block");
  block.appendChild(el("h3", "", t("squadMembers", { n: active.length })));
  const ul = el("ul", "list squad-members");
  for (const m of active) ul.appendChild(memberRow(m, commander, s.memberId));
  block.appendChild(ul);
  if (commander && removed.length) {
    block.appendChild(el("h4", "", t("squadRemovedHead")));
    const rl = el("ul", "list squad-members");
    for (const m of removed) rl.appendChild(memberRow(m, commander, s.memberId));
    block.appendChild(rl);
  }
  root.appendChild(block);

  // командир
  if (commander) {
    const tools = el("section", "squad-block");
    const row = el("div", "row");
    if (s.terrain !== getRoot().cur) {
      row.appendChild(button(t("squadMapSet"), () => sendAdmin({ a: "terrain", id: getRoot().cur })));
    }
    row.appendChild(
      button(t("squadShareMarks"), () => {
        const n = shareLocalMarks();
        toast(t("squadShared", { n }));
        window.dispatchEvent(new CustomEvent("mortar:squad"));
      })
    );
    tools.appendChild(row);
    const row2 = el("div", "row");
    if (squadInfo.phase === "active") {
      row2.appendChild(
        button(t("squadEndBtn"), () => {
          void ask(t("squadEndTitle"), t("squadEndText"), t("squadEndBtn")).then((ok) => {
            if (ok) sendAdmin({ a: "end" });
          });
        }, "btn danger")
      );
    }
    row2.appendChild(
      button(t("squadDeleteBtn"), () => {
        void ask(t("squadDeleteTitle"), t("squadDeleteText"), t("squadDeleteBtn")).then((ok) => {
          if (ok) sendAdmin({ a: "delete" });
        });
      }, "btn danger")
    );
    tools.appendChild(row2);
    root.appendChild(tools);
  }

  const leave = el("div", "row");
  leave.appendChild(
    button(t("squadLeaveBtn"), () => {
      void ask(t("squadLeaveTitle"), t("squadLeaveText"), t("squadLeaveBtn")).then(async (ok) => {
        if (!ok) return;
        const keep = await ask(t("squadKeepTitle"), t("squadKeepText"), t("squadKeepYes"));
        leaveSquad(keep !== null);
      });
    }, "btn danger")
  );
  root.appendChild(leave);
}

export function render(): void {
  const root = document.getElementById("pane-squad");
  if (!root) return;
  // не губимо те, що користувач уже вписав, коли панель перемальовується (відповідь сервера, чужа правка)
  const active = document.activeElement;
  const focus = (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && root.contains(active) ? { id: active.id, value: active.value, at: active.selectionStart } : null;
  const typed = new Map<string, string>();
  for (const i of root.querySelectorAll<HTMLInputElement>("#squadCallsign, #squadInvite")) typed.set(i.id, i.value);
  const scroll = root.parentElement?.scrollTop ?? 0;
  root.textContent = "";
  if (squadInfo.session) renderIn(root);
  else renderStart(root);
  renderReport(root);
  for (const [id, v] of typed) {
    const i = root.querySelector<HTMLInputElement>("#" + id);
    if (i && v) i.value = v;
  }
  if (focus && focus.id) {
    const e = root.querySelector<HTMLInputElement | HTMLTextAreaElement>("#" + focus.id);
    if (e) {
      e.value = focus.value;
      e.focus();
      if (focus.at !== null) e.setSelectionRange(focus.at, focus.at);
    }
  }
  if (root.parentElement) root.parentElement.scrollTop = scroll;
}

/** Запрошення з адреси сторінки: відкриває вкладку й підставляє посилання. */
export function openInvite(inv: Invite): boolean {
  if (squadInfo.session) return false;
  invitePrefill = `${inv.room}.${inv.code}`;
  showTab?.();
  render();
  return true;
}

export function initSquadPanel(opts: { showTab: () => void; afterTerrainSwitch: () => void }): void {
  showTab = opts.showTab;
  afterTerrainSwitch = opts.afterTerrainSwitch;
  onSquadChange(render);
  onLangChange(render);
  resumeSquad();
  render();
}
