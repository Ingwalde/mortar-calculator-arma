/**
 * Звуки пострілу, польоту й влучання (WebAudio, без файлів). Робляться з фільтрованого шуму й низьких
 * «падаючих» тонів, а не з чистих писків: глухий «тунк» при пострілі, ледь чутний свист у польоті,
 * низький гуркіт із коротким тріском при влучанні й м'яка «кімнатна» луна.
 * AudioContext створюється за жестом користувача (натискання «Постріл»), тож iOS дозволяє відтворення;
 * влучання планується наперед на точний момент прильоту, тому не залежить від таймерів вкладки.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbSend: GainNode | null = null;

function context(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) {
      ctx = new Ctor();
      // загальний тракт: компресор, щоб гуркіт не різав слух, + коротка луна
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -22;
      comp.ratio.value = 5;
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(comp).connect(ctx.destination);

      const verb = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.4);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      verb.buffer = ir;
      reverbSend = ctx.createGain();
      reverbSend.gain.value = 0.28;
      reverbSend.connect(verb).connect(master);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBuffer(c: AudioContext, sec: number): AudioBuffer {
  const n = Math.max(1, Math.floor(c.sampleRate * sec));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  // рожевуватий шум: сума білого з низькочастотним згладжуванням — менш різкий за білий
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    last = last * 0.82 + w * 0.18;
    d[i] = last * 3.2;
  }
  return buf;
}

function connectOut(c: AudioContext, node: AudioNode, wet = 0.5): void {
  if (!master) return;
  node.connect(master);
  if (reverbSend) {
    const w = c.createGain();
    w.gain.value = wet;
    node.connect(w).connect(reverbSend);
  }
}

/** Низький «падаючий» тон (гуркіт/тунк): синус з швидким спадом висоти й затуханням. */
function thump(c: AudioContext, at: number, f0: number, f1: number, len: number, gain: number): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(f0, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(18, f1), at + len);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  osc.connect(g);
  connectOut(c, g, 0.35);
  osc.start(at);
  osc.stop(at + len + 0.05);
}

/** Шумовий сплеск через фільтр: тріск, «вдих» пострілу, вибух. */
function burst(
  c: AudioContext,
  at: number,
  len: number,
  gain: number,
  filter: { type: BiquadFilterType; f0: number; f1: number; q?: number },
  wet = 0.5
): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, len + 0.1);
  const f = c.createBiquadFilter();
  f.type = filter.type;
  f.Q.value = filter.q ?? 0.8;
  f.frequency.setValueAtTime(filter.f0, at);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, filter.f1), at + len);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(f).connect(g);
  connectOut(c, g, wet);
  src.start(at);
  src.stop(at + len + 0.1);
}

/** Тихий свист міни в польоті: смуговий шум, що плавно «опускається» і наближається. */
function whistle(c: AudioContext, at: number, len: number): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, len + 0.1);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 5;
  f.frequency.setValueAtTime(2100, at);
  f.frequency.exponentialRampToValueAtTime(820, at + len);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(0.012, at + Math.min(1.2, len * 0.3));
  g.gain.linearRampToValueAtTime(0.045, at + len * 0.92);
  g.gain.linearRampToValueAtTime(0.0001, at + len);
  src.connect(f).connect(g);
  connectOut(c, g, 0.3);
  src.start(at);
  src.stop(at + len + 0.1);
}

/** Постріл зараз і влучання через `flightSec` секунд. */
export function playShot(flightSec: number): void {
  const c = context();
  if (!c) return;
  const t0 = c.currentTime + 0.02;
  // постріл: глухий «тунк» + короткий низький «видих»
  thump(c, t0, 120, 38, 0.32, 0.7);
  burst(c, t0, 0.28, 0.45, { type: "lowpass", f0: 1400, f1: 180, q: 0.6 }, 0.6);
  // політ
  const fly = Math.max(0.6, flightSec - 0.6);
  if (flightSec > 2) whistle(c, t0 + 0.5, fly);
  // влучання: гуркіт, тріск і довгий затухаючий хвіст
  const hit = t0 + Math.max(0.5, flightSec);
  thump(c, hit, 78, 24, 1.1, 0.95);
  burst(c, hit, 1.5, 0.75, { type: "lowpass", f0: 900, f1: 70, q: 0.5 }, 0.8);
  burst(c, hit, 0.07, 0.3, { type: "highpass", f0: 2400, f1: 1800, q: 0.7 }, 0.2);
}
