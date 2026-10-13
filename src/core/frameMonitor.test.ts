import { describe, expect, it } from "vitest";
import { FrameMonitor } from "./frameMonitor";

function run(intervalMs: number, frames: number, moving = true): boolean {
  const m = new FrameMonitor();
  let t = 1000;
  let slow = false;
  for (let i = 0; i < frames; i++) {
    t += intervalMs;
    slow = m.frame(t, moving);
  }
  return slow;
}

describe("FrameMonitor", () => {
  it("плавні 60 кадр/с — не економимо", () => {
    expect(run(16.7, 80)).toBe(false);
  });
  it("стійкі ~20 кадр/с (50 мс) — вмикаємо економний режим", () => {
    expect(run(50, 80)).toBe(true);
  });
  it("рішення лише після достатньої кількості вимірів", () => {
    expect(run(50, 10)).toBe(false);
  });
  it("нерухома карта не рахується, навіть якщо кадри рідкі", () => {
    expect(run(80, 80, false)).toBe(false);
  });
  it("паузи між жестами (>250 мс) не псують статистику", () => {
    const m = new FrameMonitor();
    let t = 0;
    let slow = false;
    for (let i = 0; i < 60; i++) {
      t += i % 5 === 0 ? 1200 : 16.7; // жест — пауза — жест
      slow = m.frame(t, true);
    }
    expect(slow).toBe(false);
  });
});
