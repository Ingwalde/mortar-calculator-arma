# Relay server for squad mode

One Cloudflare Worker plus one Durable Object (SQLite storage, WebSocket Hibernation) per squad. All rules live in
`../src/core/squad` (`Room`): this folder only carries the transport, hashing and storage. Design: `../docs/squad-mode.md`.

Local run (no Cloudflare account needed):

```bash
npm install
npm run dev
node test/e2e.mjs
```

Deploy: the **Relay** workflow in GitHub Actions (manual), which needs the secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`.

Deployed relay: `https://mortar-tablet-relay.gdimas0603.workers.dev` (check it with `RELAY=<url> node test/e2e.mjs`; the script deletes its test squad at the end).

Checks: `test/e2e.mjs` (roles, removal, report; add `RELAY=<url>` to run against the deployed relay), `test/limits.mjs`
(run `wrangler dev --var CREATE_LIMIT_PER_DAY:2` first) and `test/load.mjs` (20 clients; use the deployed relay for an exact result,
because the local dev server drops messages under bursts).

Protections: a squad can be created at most `CREATE_LIMIT_PER_DAY` times per address and `CREATE_LIMIT_GLOBAL_PER_DAY` times
overall per day (the address is kept only as a one-day hash), and `CREATE_DISABLED=1` switches creation off. All three are in `wrangler.toml`.
