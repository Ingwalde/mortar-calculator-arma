import { describe, expect, it } from "vitest";
import { buildShareUrl, decodeShare, encodeShare, extractSharePayload, isOwnShareUrl, shareToExchangeText, MAX_QR_URL_LENGTH } from "./shareLink";
import { buildExport, parseExchange, type XMarker } from "./markerExchange";

const sample: XMarker[] = [
  { id: "a1", name: "Міномет-1", type: "mortar", x: 5400.5, z: 5300, h: 120, w: "M252", folder: "Місія 1", u: 1700000000001 },
  { id: "a2", name: "Ціль А", type: "target", x: 6700, z: 6100, h: null, w: "2B14", folder: "Місія 1", u: 1700000000002 },
  { id: "a3", name: "Спостерігач", type: "point", x: 6200, z: 5600, h: null, w: "M252", folder: "Інша", u: 1700000000003 }
];

function doc(folder: string | null) {
  const types = new Set(["mortar", "target", "point"] as const);
  return buildExport(sample, { terrain: "everon", terrainName: "Everon", folder, types, now: 1 });
}

describe("shareLink", () => {
  it("кругова передача зберігає мітки, id і час правки", async () => {
    const d = doc(null);
    const back = await decodeShare(await encodeShare(d));
    expect(back).not.toBeNull();
    expect(back!.terrain).toBe("everon");
    expect(back!.terrainName).toBe("Everon");
    expect(back!.folder).toBeNull();
    expect(back!.markers).toEqual(d.markers);
  });

  it("з однієї папки: папка береться з заголовка, а не повторюється в кожній мітці", async () => {
    const d = doc("Місія 1");
    const a = await encodeShare(d);
    const back = await decodeShare(a);
    expect(back!.folder).toBe("Місія 1");
    expect(back!.markers.map((m) => m.folder)).toEqual(["Місія 1", "Місія 1"]);
  });

  it("посилання з payload розпізнається й дає текст, який приймає parseExchange", async () => {
    const url = buildShareUrl(await encodeShare(doc(null)));
    expect(url.startsWith("https://")).toBe(true);
    expect(extractSharePayload(`ось: ${url} дякую`)).not.toBeNull();
    const text = await shareToExchangeText(url);
    const parsed = parseExchange(text!);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.markers).toHaveLength(3);
  });

  it("невалідні й небезпечні вхідні дані дають null, а не помилку", async () => {
    expect(await decodeShare("")).toBeNull();
    expect(await decodeShare("!!!не base64!!!")).toBeNull();
    expect(await decodeShare("AAAA")).toBeNull();
    expect(extractSharePayload("https://example.com/#x=1")).toBeNull();
    expect(await shareToExchangeText("просто текст")).toBeNull();
  });

  it("відкидає «бомбу»: розпакований вміст понад ліміт", async () => {
    const big = "a".repeat(3_000_000);
    const stream = new Blob([new TextEncoder().encode(JSON.stringify({ v: 1, t: "x", f: null, m: [], pad: big }))])
      .stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const payload = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(await decodeShare(payload)).toBeNull();
  });

  it("типова місія з 12 міток вміщається в QR", async () => {
    const many: XMarker[] = Array.from({ length: 12 }, (_, i) => ({
      id: `id${i}abcde`,
      name: `Ціль ${i + 1}`,
      type: "target",
      x: 3000 + i * 137.5,
      z: 4000 + i * 91,
      h: null,
      w: "M252",
      folder: "Операція",
      u: 1700000000000 + i
    }));
    const d = buildExport(many, { terrain: "everon", folder: "Операція", types: new Set(["target"] as const), now: 1 });
    const url = buildShareUrl(await encodeShare(d));
    expect(url.length).toBeLessThan(MAX_QR_URL_LENGTH);
  });
});

describe("shareLink: зруйновані мітки", () => {
  it("прапорець «зруйновано» переживає кругову передачу, мінометів не стосується", async () => {
    const marks: XMarker[] = [
      { id: "t1", name: "Будівля", type: "target", x: 1, z: 2, h: null, w: "M252", folder: "", u: 5, destroyed: true },
      { id: "t2", name: "Ціль", type: "target", x: 3, z: 4, h: null, w: "M252", folder: "", u: 6 },
      { id: "p1", name: "Точка", type: "point", x: 5, z: 6, h: null, w: "M252", folder: "", u: 7, destroyed: true }
    ];
    const d = buildExport(marks, { terrain: "everon", folder: null, types: new Set(["mortar", "target", "point"] as const), now: 1 });
    const back = await decodeShare(await encodeShare(d));
    expect(back!.markers.map((m) => [m.id, m.type, !!m.destroyed])).toEqual([
      ["t1", "target", true],
      ["t2", "target", false],
      ["p1", "point", true]
    ]);
  });
});

describe("shareLink: безпека", () => {
  it("isOwnShareUrl приймає лише нашу веб-версію", () => {
    expect(isOwnShareUrl("https://ingwalde.github.io/mortar-tablet/#s=abc")).toBe(true);
    expect(isOwnShareUrl("https://ingwalde.github.io/mortar-tablet/")).toBe(true);
    expect(isOwnShareUrl("http://ingwalde.github.io/mortar-tablet/#s=abc")).toBe(false);
    expect(isOwnShareUrl("https://evil.example/mortar-tablet/#s=abc")).toBe(false);
    expect(isOwnShareUrl("https://ingwalde.github.io.evil.example/mortar-tablet/#s=abc")).toBe(false);
    expect(isOwnShareUrl("https://ingwalde.github.io/other/#s=abc")).toBe(false);
    expect(isOwnShareUrl("мотлох")).toBe(false);
  });
});
