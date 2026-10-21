import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The documentation is kept in English and the README is kept in step with the code: this test fails when it drifts.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string): string => readFileSync(join(root, p), "utf8");

function docFiles(): string[] {
  const out = ["README.md", "SECURITY.md", "THIRD-PARTY-NOTICES.md", "LICENSE"];
  for (const dir of ["legal", "legal/native"]) {
    for (const f of readdirSync(join(root, dir))) if (f.endsWith(".md")) out.push(`${dir}/${f}`);
  }
  return out;
}

describe("documentation", () => {
  it("is written in English (no Cyrillic text)", () => {
    for (const f of docFiles()) {
      const bad = read(f)
        .split("\n")
        .map((line, i) => ({ line, n: i + 1 }))
        .filter((x) => /[Ѐ-ӿ]/.test(x.line));
      expect(bad.map((x) => `${f}:${x.n}`), `${f} contains Cyrillic text`).toEqual([]);
    }
  });
});

describe("README", () => {
  const readme = read("README.md");
  const scripts = Object.keys((JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts);

  it("mentions only npm scripts that exist", () => {
    const used = [...readme.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((s) => !scripts.includes(s))).toEqual([]);
  });

  it("mentions only repository paths that exist", () => {
    const paths = [...readme.matchAll(/`((?:scripts|src|legal|test|resources|\.github)\/[^\s`]+)`/g)]
      .map((m) => m[1].replace(/[.,;:]+$/, ""))
      .filter((p) => !/[<>*…]/.test(p));
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter((p) => !existsSync(join(root, p)))).toEqual([]);
  });

  it("links only to files and headings that exist", () => {
    const slugs = new Set(
      [...readme.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) =>
        m[1]
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s-]/gu, "")
          .trim()
          .replace(/\s+/g, "-")
      )
    );
    const missing: string[] = [];
    for (const m of readme.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^https?:/.test(target)) continue;
      if (target.startsWith("#")) {
        if (!slugs.has(target.slice(1))) missing.push(target);
        continue;
      }
      if (!existsSync(join(root, target.split("#")[0]))) missing.push(target);
    }
    expect(missing).toEqual([]);
  });

  it("has no hard-coded version numbers", () => {
    expect(readme.match(/\b\d+\.\d+\.\d+\b/g) ?? []).toEqual([]);
  });

  it("covers every supported platform", () => {
    for (const platform of ["Windows", "macOS", "Linux", "Android", "iPhone"]) expect(readme).toContain(platform);
  });
});
