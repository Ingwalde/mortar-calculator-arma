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
  start() {
    this.started++;
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
  createBuffer(_c: number, len: number) {
    return { getChannelData: () => new Float32Array(len) };
  }
  createBufferSource() {
    const n = new FakeNode();
    created.push(n);
    return n;
  }
  getOutputTimestamp() {
    return { contextTime: this.currentTime, performanceTime: performance.now() };
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
});
