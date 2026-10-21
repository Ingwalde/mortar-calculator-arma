import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dictKeys } from "./i18n";

const keys = new Set(dictKeys());
const root = join(__dirname);

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "public" ? [] : sources(p);
    return /\.(ts|html)$/.test(e.name) && !e.name.endsWith(".test.ts") ? [p] : [];
  });
}

describe("переклади", () => {
  it("кожен ключ, що використовується в коді й розмітці, є у словнику, і має обидві мови", () => {
    const missing: string[] = [];
    for (const file of sources(root)) {
      const text = readFileSync(file, "utf8");
      const found = [
        ...text.matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"/g),
        ...text.matchAll(/data-i18n(?:-[a-z-]+)?="([A-Za-z0-9_]+)"/g)
      ];
      for (const m of found) if (!keys.has(m[1])) missing.push(`${file.slice(root.length + 1)}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });

  it("ключі звіту, які використовує ядро, перекладено", () => {
    const text = readFileSync(join(__dirname, "../core/squad/reportHtml.ts"), "utf8");
    const block = text.slice(text.indexOf("export type ReportKey"), text.indexOf("export type Tr"));
    const used = [...block.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(30);
    expect(used.filter((k) => !keys.has(k))).toEqual([]);
  });
});
