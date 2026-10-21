// Checks the creation limits against `wrangler dev --var CREATE_LIMIT_PER_DAY:2` (default http://127.0.0.1:8788).
import assert from "node:assert/strict";

const BASE = process.env.RELAY ?? "http://127.0.0.1:8788";
const create = () => fetch(BASE + "/create", { method: "POST", body: JSON.stringify({ callsign: "Wolf" }) });

const a = await create();
const b = await create();
assert.equal(a.status, 200);
assert.equal(b.status, 200);
const c = await create();
assert.equal(c.status, 429, "the third creation from one address is refused");
assert.deepEqual(await c.json(), { error: "limit" });
console.log("limits: ok");
