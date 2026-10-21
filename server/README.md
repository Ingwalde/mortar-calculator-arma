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
