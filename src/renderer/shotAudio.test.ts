import { describe, expect, it, beforeEach, vi } from "vitest";

/** Мінімальна підробка WebAudio: рахує запущені/зупинені джерела. */
class FakeNode {
  frequency = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  gain = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} };
  Q = { value: 0 };
  type = "";
  buffer: unknown = null;
  started = 0;
  stopped = 0;
  listeners: Record<string, () => void> = {};
  connect(n: unknown) {
    return n;
  }
  addEventListener(ev: string, cb: () => void) {
    this.listeners[ev] = cb;
  }
  startAt: number[] = [];
  start(at = 0) {
    this.started++;
    this.startAt.push(at);
  }
  stop() {
    this.stopped++;
  }
}
const created: FakeNode[] = [];
class FakeCtx {
  currentTime = 0;
  state = "running";
  sampleRate = 8000;
  baseLatency = 0;
  destination = {};
  createGain() {
    const n = new FakeNode();
    created.push(n);
    return n;
  }
  createOscillator() {
    const n = new FakeNode();
    created.push(n);
    return n;
  }
  createBiquadFilter() {
    return new FakeNode();
  }
  createDynamicsCompressor() {
    const n = new FakeNode() as FakeNode & { threshold: { value: number }; ratio: { value: number } };
    n.threshold = { value: 0 };
    n.ratio = { value: 0 };
    return n;
  }
  createConvolver() {
    return new FakeNode();
  }
  createWaveShaper() {
    const n = new FakeNode() as FakeNode & { curve: unknown; oversample: string };
    n.curve = null;
    n.oversample = "none";
    return n;
  }
  createBuffer(_c: number, len: number) {
    return { getChannelData: () => new Float32Array(len) };
  }
  createBufferSource() {
    const n = new FakeNode();
    created.push(n);
    return n;
  }
  /** Після згортання пара застаріла: годинник аудіо стояв. Код не повинен на неї спиратись. */
  stalePair = false;
  getOutputTimestamp() {
    return this.stalePair
      ? { contextTime: 3, performanceTime: performance.now() - 120000 }
      : { contextTime: this.currentTime, performanceTime: performance.now() };
  }
  static last: FakeCtx | null = null;
  constructor() {
    FakeCtx.last = this;
  }
  resume() {
    return Promise.resolve();
  }
}

describe("shotAudio: згортання застосунку", () => {
  let handlers: Record<string, () => void>;
  let doc: { hidden: boolean };
  beforeEach(() => {
    vi.resetModules();
    created.length = 0;
    FakeCtx.last = null;
    handlers = {};
    doc = { hidden: false };
    const target = {
      addEventListener: (ev: string, cb: () => void) => {
        handlers[ev] = cb;
      }
    };
    vi.stubGlobal("document", Object.assign(doc, target));
    vi.stubGlobal("window", Object.assign({ AudioContext: FakeCtx }, target));
  });

  it("при згортанні зупиняє всі заплановані звуки", async () => {
    const mod = await import("./shotAudio");
    await mod.playShot(20, performance.now());
    const sources = created.filter((n) => n.started > 0);
    expect(sources.length).toBeGreaterThan(3);
    // кожне джерело вже має заплановану зупинку (stop(at)) — запам'ятовуємо лічильники
    const before = sources.map((n) => n.stopped);
    doc.hidden = true;
    handlers.visibilitychange();
    // при згортанні кожне джерело зупиняється негайно ще раз
    expect(sources.every((n, i) => n.stopped === before[i] + 1)).toBe(true);
  });

  it("після повернення не дограє звук, якщо міна вже долетіла", async () => {
    const mod = await import("./shotAudio");
    // постріл, що «стався» 30 с тому з польотом 5 с — візуально давно влучив
    await mod.playShot(5, performance.now() - 30000);
    doc.hidden = true;
    handlers.visibilitychange();
    const before = created.filter((n) => n.started > 0).length;
    doc.hidden = false;
    handlers.visibilitychange();
    const after = created.filter((n) => n.started > 0).length;
    expect(after).toBe(before);
  });

  it("після повернення дограє лише залишок, якщо міна ще в польоті", async () => {
    const mod = await import("./shotAudio");
    await mod.playShot(20, performance.now() - 5000);
    doc.hidden = true;
    handlers.visibilitychange();
    const before = created.filter((n) => n.started > 0).length;
    doc.hidden = false;
    handlers.visibilitychange();
    await Promise.resolve();
    const after = created.filter((n) => n.started > 0).length;
    expect(after).toBeGreaterThan(before);
  });

  it("залишок після повернення рахується від «зараз», а не за застарілою парою годинників", async () => {
    const mod = await import("./shotAudio");
    // політ 30 с, запущений 10 с тому: лишилось ~20 с
    await mod.playShot(30, performance.now() - 10000);
    const c = FakeCtx.last!;
    doc.hidden = true;
    handlers.visibilitychange();
    created.forEach((n) => (n.startAt = []));
    c.currentTime = 500; // годинник аудіо пішов далі після запуску
    c.stalePair = true;
    doc.hidden = false;
    handlers.visibilitychange();
    await new Promise((r) => setTimeout(r, 0));
    const starts = created.flatMap((n) => n.startAt).filter((x) => x > 500);
    expect(starts.length).toBeGreaterThan(0);
    const impact = Math.max(...starts);
    // влучання приблизно через 20 с від поточного часу аудіо (500), а не від застарілих 3
    expect(impact).toBeGreaterThan(515);
    expect(impact).toBeLessThan(525);
  });
});
