# Squad mode (release 1.1.0): design and plan

Status: **draft for approval**. No code has been written. Open decisions are listed in section 17; everything else below
is what has been agreed so far.

## 1. Goal

A squad plays Arma Reforger from different places. The squad leader (or any soldier) marks an enemy on the map, and the
mortar crew sees the mark at once, enters it into the firing log, sees all the calculations and aims by them, without
leaving the tablet. The tool must work for several independent squads at the same time, keep a record of who marked
what, and give the leader a summary report when the game ends.

Non-goals for 1.1.0: voice or text chat, accounts and passwords, Discord sign-in, live positions of players, lines and
polygons on the map (phase lines, routes, no-fire areas as polygons), peer-to-peer connections, a native iOS app.

## 2. Decisions already made

| Topic | Decision |
| --- | --- |
| Architecture | A server relay (not peer-to-peer): only a server can enforce roles and keep a trustworthy record |
| Unit of cooperation | One **squad** = one room. Squads are fully isolated from each other; there is no operation above squads |
| Roles | **Commander**, **mortarman**, **soldier**; the commander assigns who is a mortarman |
| Sign-in | A **callsign** typed at joining; no accounts, no Discord |
| Marks | Affiliation **friend / hostile** (and neutral / unknown for commander and mortarman), more mark types with real military designations, captions explaining the symbols, author and time on every mark |
| Soldier | Sees all marks, marks only hostile and friendly, moves only his own marks (never a mortar), can mark a building destroyed, has no solution and no firing log |
| Firing log | Only for mortarmen and the commander |
| Member removal | The commander can remove a member, and can **restore** access later |
| Game over | The commander ends the game and gets a statistics report; the report can be edited by the commander and by members he allows, saved to a file and imported for viewing later |
| Retention | The server deletes the squad's data after the report is exported; if it is not exported within 24 hours after the game ended, it is deleted anyway |
| Danger warning | If a friendly mark lies inside the dispersion radius plus the fragmentation range of the shell, show a non-blocking warning in the solution and in the log |
| Fragmentation range | Taken from the explosion data of the shells in the game files (decided) |
| Report language | The language the application is set to (decided) |
| LAN view | Removed in 1.0.1 |
| Later | Lines and zones; possibly the real APP-6 symbol renderer |

## 3. Concepts

- **Squad**: a room on the server with a secret **join code**, a commander and members. Data lives only on the server and on members' devices.
- **Member**: a device that joined with a **callsign** (unique in the squad, case-insensitive, 2 to 16 characters from letters, digits, `-`, `_`, space). The device holds a random **member key** that proves its identity to the server.
- **Role**: `commander`, `mortarman` or `soldier`. The creator of the squad is the commander. Roles are changed only by the commander. There is exactly one commander at a time; the commander can hand the role over.
- **Editor flag** (after the game ends): a member the commander allows to edit the report.
- **Mark**: a point on the map (section 5).
- **Fire mission entry**: a firing-log entry of a mortarman (the existing log), shared inside the squad for mortarmen and the commander.
- **Event log**: the server's append-only record of what happened in the squad (section 9).

## 4. Permissions

The **server enforces** every rule below; the client only hides what a role may not do.

| Action | Commander | Mortarman | Soldier |
| --- | --- | --- | --- |
| See all marks, captions, authors | yes | yes | yes |
| Create a mark of any affiliation and type | yes | yes | no |
| Create a hostile mark | yes | yes | yes |
| Create a friendly mark (own position or friendly units) | yes | yes | yes |
| Create a neutral / unknown mark | yes | yes | no |
| Create or move a **mortar** mark | yes | yes (own mortar) | no |
| Edit, move or delete a mark of someone else | yes | yes | no |
| Edit, move or delete his own mark | yes | yes | yes, except a mortar (a soldier has none) |
| Add or edit a caption of a mark | any mark | any mark | his own marks and hostile marks |
| Mark a building destroyed or restore it | yes | yes | yes |
| Open the solution (azimuth, elevation, charge) and the firing log | yes | yes | no |
| See friendly-fire warnings | yes | yes | no |
| Create the squad, change roles, remove and restore members, end the game, delete the squad | yes | no | no |
| Edit the report after the game ended | yes | only if allowed | only if allowed |

Details to confirm are in section 17 (D6, D7).

## 5. Marks

Current marks are `mortar`, `target` and `point` with a name, folder, coordinates, height and a destroyed flag. 1.1.0 extends them:

| Field | Meaning |
| --- | --- |
| `id` | Random id, created by the author's device |
| `affiliation` | `friend`, `hostile`, `neutral`, `unknown` (later `suspect`, `assumed-friend`) |
| `kind` | The symbol type (section 6); `mortar` stays a kind |
| `name` | Short name shown on the map |
| `caption` | Free text, up to 120 characters |
| `x`, `z`, `h` | Game coordinates and optional height |
| `status` | `active`, `destroyed` (later `damaged`, `suspected`) |
| `author` | The member that created it (id and callsign at that time) |
| `createdAt`, `updatedAt`, `updatedBy` | Server time and the member who last changed it |
| `deleted` | Tombstone, kept until the game ends |

Migration of existing local marks: `mortar` → friendly mortar; `target` → hostile target; `point` → unknown point. The old
share format (link, QR, file) stays readable; the new one carries affiliation and kind. Local use without a squad stays
fully working.

## 6. Mark types and symbols

Affiliation frames follow NATO APP-6 and MIL-STD-2525: **friend** is a blue rectangle, **hostile** a red diamond,
**neutral** a green square, **unknown** a yellow quatrefoil.

Proposed kinds (icon inside the frame), each with a short caption in Ukrainian and English shown on demand
(a "?" legend and a tap on an unknown symbol):

- Units: infantry, armour, wheeled vehicle / APC, anti-tank (AT) team, machine gun (MG), sniper, mortar, artillery, helicopter / aircraft, engineers / minefield, command post (CP), observation post (OP), checkpoint, MEDEVAC.
- Fire control: target (numbered), target reference point (TRP), registration point, forward observer (FO), no-fire area (NFA) and restricted-fire area (RFA) as circles with a radius, battle damage assessment (BDA).
- Status overlays: destroyed (exists), damaged, suspected.

Lines and polygons are phase 2 (after 1.1.0).

Two ways to draw the symbols; the data model is the same for both (`affiliation` + `kind`), so the choice does not change the protocol.
Both were rendered for review. With the milsymbol renderer (version 2.2.0), the standard codes that render with a clear
symbol are: infantry `SHGPUCI`, armour `SHGPUCA`, anti-armour `SHGPUCAA`, mortar `SHGPUCFM`, artillery `SHGPUCF`,
reconnaissance `SHGPUCR`, engineers `SHGPUCE`, air defence `SHGPUCD`, helicopter `SHAPMH`, command post `SHGPUH`,
mines `SHGPEXM`, vehicle `SHGPEVAL` (with `SF`, `SN`, `SU` for the other affiliations). No clear standard code was found for
machine gun, sniper, observation post and MEDEVAC: those would need an own glyph in the same frame, so a pure APP-6
choice is not possible and the real-symbols option means a mix. The codes must be re-verified against the standard's list
when implementing.

| | Own simple icons | Real APP-6 / 2525 symbols (milsymbol, MIT) |
| --- | --- | --- |
| Look | Frames by affiliation, a simple glyph | The symbols military users already know |
| Size and effort | Small, quick | One more dependency and larger bundle; must be checked for size and the SIDC codes of every kind |
| Recommendation | First step | Optional later switch |

## 7. Danger warning for friendly marks

For a calculated target and the chosen shell:

`danger radius = dispersion radius (settings, existing) + fragmentation range of the shell`.

If any mark with affiliation `friend` lies inside this circle around the target, the solution panel shows a warning line
("Friendly mark «Alpha-2» is 110 m from the target, inside the danger area of 115 m") that **does not block** aiming, and the same
text is saved in the firing-log entry. Several warnings are listed shortest distance first. The warning is computed on
the client from the synchronised marks; it is shown to commander and mortarmen only. The age of the friendly mark
("updated 4 min ago") is shown next to it, because positions go stale.

The **fragmentation range per shell** is not in the current tables. It is read from the explosion parameters of the
shells in the game files (as was done for the dispersion) by an extraction script, per shell and per weapon. If a value
cannot be found for a shell, the warning for that shell is disabled and the interface says so; no invented number is used.
The source and the extraction date go into `legal/ASSET-PROVENANCE.md`.

## 8. Protocol

Transport: secure WebSocket (`wss`), JSON text frames, protocol version in every message. A message has `t` (type) and `v` (version).

Client to server:

| `t` | Purpose |
| --- | --- |
| `hello` | Join with the join code, callsign and member key (a new device sends no key and receives one) |
| `op` | One change: create, update, move, delete, set status, set caption; with a client-generated `opId` for idempotency |
| `log` | A firing-log entry (mortarman or commander) |
| `admin` | Commander only: set role, remove, restore, rotate the join code, allow report editing, end game, delete squad |
| `report` | After the game: edit a report field (commander or allowed editor) |
| `ping` | Keep-alive (answered by the platform without waking the server code where possible) |

Server to client:

| `t` | Purpose |
| --- | --- |
| `snapshot` | The visible state for the member's role (marks, members, own role, last sequence number) |
| `op` | A change applied, with the server sequence number, author and server time |
| `reject` | An operation refused, with a reason code (permission, deleted mark, limit, stale) |
| `members` | Members and who is online; role changes; removal and restoration |
| `ended` | The commander ended the game; the report follows |
| `error` | Fatal problem (bad code, removed, rate limit, server limit) |

Rules:

- The **server is authoritative**: it validates the role for every operation, assigns a monotonically increasing sequence number per squad and the time, and broadcasts the accepted operation to everybody who may see it.
- Per mark, the **last accepted change wins field by field**; deleting a mark leaves a tombstone, so a late update of a deleted mark is rejected.
- **Offline first**: the client applies its own operations at once, queues them, and replays them after a reconnect with the same `opId`s; the server ignores duplicates and rejects what is no longer allowed. The existing "changes waiting to sync" status is reused.
- **Reconnect** sends the last sequence number seen; the server replies with the missed operations or a fresh snapshot.
- **Message economy** (it matters for the free hosting limits): drags are sent only when released; changes of one mark within 300 ms are merged; no position streaming; no application heartbeat.
- **Limits**: 60 operations per member per minute, a message at most 8 KB, 1000 marks and 30 members per squad, a caption of 120 characters.

## 9. Identity, access and removal

- **Create**: any device can create a squad; the server returns a long random **join code** (at least 128 bits) and a member key for the commander. The invitation is a link `…/mortar-tablet/#squad=<code>` plus a QR code.
- **Join**: the device opens the link, types a callsign, and gets a member key. The server stores only a **hash** of every key.
- **Role**: a joined member is a soldier until the commander changes it.
- **Remove**: the commander removes a member; the member's key is marked `removed`, the connection is closed, the member can no longer read or write, and cannot rejoin with the same key. Marks the member created stay (with the author's callsign).
- **Restore**: the commander restores a removed member from a list of removed members; the same device gets its access back (same key, same callsign), without a new join code.
- **Rotate the join code**: the commander can invalidate the old invitation link; current members are not affected.
- **No accounts** also means no protection against someone who types another person's callsign on a new device; the commander decides whom to let in and can remove a member at any time. A callsign cannot be taken twice in the same squad.
- The join code is a secret: it never appears in server logs, and it travels in the URL fragment, which browsers do not send to a server.

## 10. Backend

Proposed host: **Cloudflare Workers with one Durable Object per squad** (SQLite-backed storage, the WebSocket
Hibernation API), no accounts or servers to run, deployed from this repository.

Why: a Durable Object is a single authoritative place per squad, with built-in persistent storage and alarms (needed for
the retention rules), and it can sleep between messages.

Free-plan figures checked on the provider's pages on the date of this plan (to be re-checked before development, because they change):
100,000 Durable Object requests per day (WebSocket messages are counted as requests), 13,000 GB-s of duration per day,
5 GB of storage per account, daily limits reset at 00:00 UTC, and what exceeds a limit fails with an error until the next day
([pricing](https://developers.cloudflare.com/durable-objects/platform/pricing),
[limits](https://developers.cloudflare.com/durable-objects/platform/limits)).

Budget (worst case, counting every message as one request): a squad of 10 whose members each change a mark every 5 seconds
for 2 hours sends about 14,000 messages, so roughly seven such two-hour games a day fit in the free plan. Real use is far
lighter (marks change rarely), and the message economy in section 8 lowers it further. If the free plan is ever
exhausted, clients keep working offline-first and sync after the limit resets; the paid plan is a small monthly fee if needed.

Protections: room creation is limited per address per day; a global switch can refuse new squads; per-member and per-squad
rate limits (section 8); a squad idle for 3 days is deleted by an alarm.

Alternatives considered: your own server (full control, but needs hosting, updates and monitoring), a managed realtime
database (the permission rules would live in database policies and the report logic outside the data), and peer-to-peer
(roles and the record cannot be enforced; it needs a signalling server anyway).

The relay code lives in a new `server/` folder with its own tests and a deployment workflow that needs two repository secrets (the host's API token and account id).

### Owner setup (one time)

1. Create a free Cloudflare account (an e-mail address; turn on two-step verification).
2. Open **Workers & Pages** once; the first visit asks you to choose the account's `workers.dev` name. No domain is needed. No payment card is needed for the free plan (confirm at sign-up).
3. Create an API token: **My Profile → API Tokens → Create Token**, use the template **Edit Cloudflare Workers**, restrict it to your account, and copy it once.
4. Copy the **Account ID** (shown on the Workers & Pages overview page).
5. Add both to the GitHub repository as secrets, from a terminal so that they are not typed anywhere else:
   `gh secret set CLOUDFLARE_API_TOKEN` and `gh secret set CLOUDFLARE_ACCOUNT_ID`.
6. Keep the token private; if it ever leaks, delete it in the same page and create a new one. The deployment runs in GitHub Actions, so the token never needs to be on a development computer. Local development uses `wrangler dev`, which needs no account.

The menu names above may differ slightly from the live dashboard.

## 11. Game over, report and retention

1. The commander presses **Game over**. The squad becomes read-only for marks; the server builds the **report** from the squad's data.
2. **Report contents**: counts of marks by affiliation and kind; destroyed targets; who marked what and when (per member); the fire missions from the firing logs (mortars, shells, charges, number of missions, friendly-fire warnings issued); a timeline of events; free-text notes.
3. **Editing**: the commander and the members he allows (the editor flag) can edit the report fields and notes until it is exported or the 24 hours have passed.
4. **Export**: the commander (or an editor) saves the report to a file: JSON with a schema version (`mortar-tablet-report/1`) and a printable HTML page. The file can be imported in the app for read-only viewing later.
5. **Deletion**: as soon as the report has been exported, the server deletes everything about the squad. If nobody exports within 24 hours after the game ended, it is deleted anyway (a server alarm). The commander can also delete the squad at any time.

## 12. Privacy

The server holds marks and coordinates of a video game, callsigns, roles, timestamps and firing-log entries. It holds no
real names, e-mail addresses or accounts. Addresses are not stored by the application; the hosting provider keeps its own
network logs under its policy. The data is deleted under the rules in section 11 and section 10. SECURITY.md and README
will describe this, and the Content Security Policy will be extended with the relay's address only.

## 13. Client changes

- **Squad panel** (new): create or join, callsign, invitation link and QR, member list with roles and who is online, commander tools (roles, remove and restore, rotate the code, allow report editing, game over), connection status.
- **Role-aware interface**: a soldier sees the map and marks only (no solution and log tabs, only the mark types he may create); mortarmen and the commander see everything.
- **Mark card**: author, time, caption, affiliation, kind, status; a legend ("?") with the meaning of every symbol; filters by affiliation or author.
- **Attribution**: toasts such as "Alpha-2 added hostile infantry"; a history list of events (for commander and mortarmen).
- **Solution and log**: the friendly-fire warning (section 7); firing-log entries shared with the other mortarmen and the commander.
- **Report view**: edit, export, import (section 11).
- **Local mode** stays: without a squad nothing changes; local marks can be sent into a squad by the commander ("add my marks to the squad").

## 14. Compatibility and removal of the old code paths

The local state gets a schema version and a migration (section 5). The share link/QR/file format gets version 2 and the old
version 1 stays readable. The sync-conflict machinery that remains from the phone view (`core/merge.ts`) is reused only
where it still fits; the server's ordering replaces it for squads.

## 15. Phases and acceptance

1. **Spec approval** (this document) and the open decisions of section 17.
2. **Data model and local features** (no server): new mark model and migration, affiliation frames and kinds, captions and legend, author and time fields, friendly-fire warning, report data structures. *Done when* local use works, every kind has a caption, the migration test passes and the warning is covered by unit tests with fixed numbers.
3. **Relay and protocol**: the server, the protocol, permissions, retention alarms, rate limits. *Done when* a table-driven test covers every cell of the permission matrix, duplicates and ordering are tested, a reconnect test passes, and a load test with 30 clients stays within the limits of section 10.
4. **Client sync and squad panel**: the sync engine with the offline queue, the role-aware interface, removal and restore, invitation links. *Done when* three browser clients in different roles pass an automated scenario (a soldier marks a hostile, a mortarman sees it and logs a mission, the commander removes and restores a member), and a dropped connection recovers without losing marks.
5. **Game over and report**: report building, editing, export and import, retention. *Done when* the exported file imports back identically and the server holds no data after export or after 24 hours.
6. **Hardening and release**: security review (SECURITY.md updated), documentation, packaged-app smoke test, real-device check on a phone and a PC, release 1.1.0. The documentation test and the README stay current in the same changes.

Tests throughout: the permission matrix, protocol conformance, ordering and idempotency, reconnect, retention, the
migration of old marks, danger-warning geometry, report export and import, and a multi-client scenario.

## 16. Risks

| Risk | Mitigation |
| --- | --- |
| Free hosting limits are exhausted | Message economy, offline-first clients, a global kill switch, a small paid plan if needed |
| Spam or abuse of squad creation | Per-address limits, a short life of idle squads, rate limits |
| Someone guesses a join code | 128-bit random codes, rotation by the commander, removal and restore |
| A phone drops the WebSocket in the background (especially iPhone) | Automatic reconnect with the last sequence number, an offline queue |
| Dependence on one hosting provider | A small protocol and a small server, so it can be moved |
| Stale friendly positions give a false sense of safety | The warning shows the age of the mark and never replaces the crew's own judgement |
| The fragmentation range is a wrong number | Only a documented source; shown with its origin |

## 17. Open decisions

- **D1 Symbols:** own simple icons first, or the real APP-6 symbols through milsymbol now? (A mock-up exists; the data model is the same.)
- **D2 Fragmentation range:** decided: read from the game files (explosion parameters per shell).
- **D3 Hosting:** the owner creates the account and the secrets (see "Owner setup" in section 10); a custom domain is optional.
- **D4 Callsign rules:** length 2 to 16 and the allowed characters as in section 3? Block empty or look-alike duplicates?
- **D5 Limits:** 30 members and 1000 marks per squad, 60 operations per minute per member: confirm or change.
- **D6 Soldier details:** may a soldier create several friendly marks (his own position only, or other friendly units)? May he caption hostile marks of others? (Section 4 assumes yes.)
- **D7 Danger warning visibility:** only the commander and mortarmen (as drafted), or also soldiers?
- **D8 Firing log sharing:** do the mortarmen see each other's entries live (drafted yes), and does the commander see all?
- **D9 Report language:** decided: the language the application is set to.
- **D10 Version number:** 1.1.0 (drafted).
