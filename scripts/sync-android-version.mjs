// Переносить версію з package.json у android/app/build.gradle (versionName / versionCode).
// versionCode = major*10000 + minor*100 + patch — зростає з кожною версією.
//   node scripts/sync-android-version.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const { version } = JSON.parse(readFileSync(root + "package.json", "utf8"));
const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
if (!m) throw new Error(`Незрозуміла версія: ${version}`);
const code = Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
const file = root + "android/app/build.gradle";
let s = readFileSync(file, "utf8");
s = s.replace(/versionCode \d+/, `versionCode ${code}`).replace(/versionName "[^"]*"/, `versionName "${version}"`);
writeFileSync(file, s);
console.log(`android: versionName ${version}, versionCode ${code}`);
