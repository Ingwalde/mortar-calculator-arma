// Через CDP навести приціл застосунку на задану світову точку (X,Z), натиснути "Поставити
// мітку" і прочитати авто-висоту. Калібрується на льоту (без потреби знати view.k заздалегідь).
const PAGE_ID = process.argv[2];
const targetX = Number(process.argv[3]);
const targetZ = Number(process.argv[4]);

const ws = new WebSocket(`ws://127.0.0.1:9222/devtools/page/${PAGE_ID}`);
let msgId = 1;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
});
function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = msgId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function evaluate(expression) {
  return send("Runtime.evaluate", { expression, returnByValue: true }).then((r) => r.result?.value);
}
async function click(x, y) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 60));
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 120));
}
async function readCenterWorld() {
  const txt = await evaluate('document.getElementById("coords").querySelector(".m").textContent');
  const m = txt.match(/X\s*([\d\s]+)\s*м\s*Z\s*([\d\s]+)\s*м/);
  return { x: Number(m[1].replace(/\s/g, "")), z: Number(m[2].replace(/\s/g, "")) };
}

await new Promise((res) => ws.addEventListener("open", res));
await send("Runtime.enable");
await evaluate('if (dlg.open) dlg.close(); document.getElementById("fit").click(); "ok"');
await new Promise((r) => setTimeout(r, 400));
console.log("after fit:", await readCenterWorld());

const rect = await evaluate('JSON.stringify(document.getElementById("cv").getBoundingClientRect())').then(JSON.parse);
const cx = rect.left + rect.width / 2;
const cy = rect.top + rect.height / 2;

const base = await readCenterWorld();
const OFFSET = Math.min(rect.width, rect.height) * 0.35;
await click(cx + OFFSET, cy);
const afterX = await readCenterWorld();
await click(cx, cy - OFFSET);
const afterZ = await readCenterWorld();

const kx = OFFSET / (afterX.x - base.x);
const kz = -OFFSET / (afterZ.z - afterX.z);
console.log("base", base, "afterX", afterX, "afterZ", afterZ, "kx,kz", kx, kz);

const cur = afterZ;
const dxPx = (targetX - cur.x) * kx;
const dzPx = (targetZ - cur.z) * kz;
await click(cx + dxPx, cy + dzPx);
const finalCenter = await readCenterWorld();
console.log("aimed for:", targetX, targetZ, "landed at:", finalCenter);

// друге, точніше коригування (лінійність не ідеальна на великих зміщеннях)
const cur2 = finalCenter;
const dxPx2 = (targetX - cur2.x) * kx;
const dzPx2 = (targetZ - cur2.z) * kz;
await click(cx + dxPx2, cy + dzPx2);
const finalCenter2 = await readCenterWorld();
console.log("after correction, landed at:", finalCenter2);

await evaluate("placeBtn.click(); 'clicked'");
await new Promise((r) => setTimeout(r, 500));
const dlgState = await evaluate(
  'JSON.stringify({open:dlg.open, h:fH.value, x:fX.value, z:fZ.value, placeholder:fH.placeholder})'
);
console.log("dialog:", dlgState);
await evaluate("fCancel.click(); 'closed'");
process.exit(0);
