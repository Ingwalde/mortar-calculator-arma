import { describe, expect, it } from "vitest";
import { apkUrlOf, isNewerVersion, parseVersion, updateFrom } from "./appVersion";

describe("appVersion", () => {
  it("розбирає версії з префіксом v і без", () => {
    expect(parseVersion("v0.11.0")).toEqual([0, 11, 0]);
    expect(parseVersion("1.2.3-beta")).toEqual([1, 2, 3]);
    expect(parseVersion("android-test")).toBeNull();
  });

  it("порівнює числово, а не рядково", () => {
    expect(isNewerVersion("v0.10.0", "0.9.0")).toBe(true);
    expect(isNewerVersion("0.9.0", "0.10.0")).toBe(false);
    expect(isNewerVersion("0.10.0", "0.10.0")).toBe(false);
    expect(isNewerVersion("1.0.0", "0.99.99")).toBe(true);
    expect(isNewerVersion("garbage", "0.1.0")).toBe(false);
  });

  it("оновлення: лише стабільний новіший реліз; APK має пріоритет над сторінкою релізу", () => {
    const rel = {
      tag_name: "v0.11.0",
      html_url: "https://github.com/x/y/releases/tag/v0.11.0",
      assets: [
        { name: "MortarTablet-Setup-0.11.0.exe", browser_download_url: "https://x/setup.exe" },
        { name: "MortarTablet-0.11.0.apk", browser_download_url: "https://x/app.apk" }
      ]
    };
    expect(apkUrlOf(rel)).toBe("https://x/app.apk");
    expect(updateFrom(rel, "0.10.0")).toEqual({ version: "0.11.0", url: "https://x/app.apk" });
    expect(updateFrom({ ...rel, assets: [] }, "0.10.0")).toEqual({ version: "0.11.0", url: rel.html_url });
    expect(updateFrom(rel, "0.11.0")).toBeNull();
    expect(updateFrom({ ...rel, prerelease: true }, "0.10.0")).toBeNull();
    expect(updateFrom({ ...rel, draft: true }, "0.10.0")).toBeNull();
    expect(updateFrom(null, "0.10.0")).toBeNull();
  });
});
