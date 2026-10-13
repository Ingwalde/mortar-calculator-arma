/**
 * Короткі звуки пострілу й влучання (WebAudio, без файлів). AudioContext створюється за жестом
 * користувача (натискання «Постріл»), тож iOS дозволяє відтворення; влучання планується наперед
 * на точний момент прильоту, тому не залежить від таймерів вкладки.
 */
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, at: number, f0: number, f1: number, len: number, gain: number, type: OscillatorType = "sine"): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + len);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + len + 0.05);
}

function noise(c: AudioContext, at: number, len: number, gain: number): void {
  const n = Math.floor(c.sampleRate * len);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(c.destination);
  src.start(at);
}

/** Постріл зараз і влучання через `flightSec` секунд. */
export function playShot(flightSec: number): void {
  const c = context();
  if (!c) return;
  const t0 = c.currentTime + 0.02;
  // «тюк» пострілу
  tone(c, t0, 180, 50, 0.22, 0.5, "triangle");
  noise(c, t0, 0.12, 0.18);
  // свист у польоті: висота тону падає до прильоту
  if (flightSec > 1) tone(c, t0 + 0.25, 1400, 500, Math.max(0.3, flightSec - 0.5), 0.05, "sine");
  // влучання
  const hit = t0 + Math.max(0.5, flightSec);
  tone(c, hit, 140, 40, 0.5, 0.6, "triangle");
  noise(c, hit, 0.35, 0.35);
}
