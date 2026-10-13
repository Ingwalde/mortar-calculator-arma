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
let muted = false;
const MASTER_GAIN = 0.55;

/** Усі запущені/заплановані джерела: при згортанні застосунку їх треба зупинити. */
const live = new Set<AudioScheduledSourceNode>();
function track(node: AudioScheduledSourceNode): void {
  live.add(node);
  node.addEventListener("ended", () => live.delete(node));
}
function stopAll(): void {
  for (const n of live) {
    try {
      n.stop();
    } catch {
      // уже зупинено
    }
  }
  live.clear();
}

/** Постріли, що ще в польоті: після повернення в застосунок дограємо лише те, що лишилось. */
const flights: { launchPerf: number; flightSec: number }[] = [];

/** Вимкнення звуку посеред польоту глушить і вже заплановане влучання. */
export function setShotMuted(m: boolean): void {
  muted = m;
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : MASTER_GAIN, ctx.currentTime, 0.03);
}

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
      master.gain.value = muted ? 0 : MASTER_GAIN;
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
  track(osc);
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
  track(src);
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
  track(src);
  src.start(at);
  src.stop(at + len + 0.1);
}

/** Планує звуки польоту й влучання від моменту `fromPerf` до візуального прильоту. */
function scheduleFlight(c: AudioContext, launchPerfMs: number, flightSec: number, includeLaunch: boolean): void {
  const impactPerf = launchPerfMs + Math.max(0.5, flightSec) * 1000;
  const latency = (c as AudioContext & { outputLatency?: number }).outputLatency ?? c.baseLatency ?? 0;
  // Годинник аудіо й годинник сторінки знімаємо в один момент і міряємо від «зараз». Пара з
  // getOutputTimestamp тут не годиться: після призупинення (згортання) вона застаріла, бо годинник
  // аудіо стояв, а сторінки йшов — влучання виходило б із запізненням на весь час згортання.
  const audioNow = c.currentTime;
  const perfNow = performance.now();
  const impactAt = audioNow + (impactPerf - perfNow) / 1000 - latency;
  const launchAt = audioNow + (launchPerfMs - perfNow) / 1000 - latency;
  const t0 = Math.max(c.currentTime + 0.01, launchAt);
  if (includeLaunch) {
    // постріл: глухий «тунк» + короткий низький «видих»
    thump(c, t0, 120, 38, 0.32, 0.7);
    burst(c, t0, 0.28, 0.45, { type: "lowpass", f0: 1400, f1: 180, q: 0.6 }, 0.6);
  }
  const hit = Math.max(c.currentTime + 0.05, includeLaunch ? Math.max(t0 + 0.5, impactAt) : impactAt);
  const flyStart = includeLaunch ? t0 + 0.5 : c.currentTime + 0.02;
  const fly = hit - flyStart - 0.3;
  if (fly > 1.5) whistle(c, flyStart, fly);
  // влучання: гуркіт, тріск і довгий затухаючий хвіст
  thump(c, hit, 78, 24, 1.1, 0.95);
  burst(c, hit, 1.5, 0.75, { type: "lowpass", f0: 900, f1: 70, q: 0.5 }, 0.8);
  burst(c, hit, 0.07, 0.3, { type: "highpass", f0: 2400, f1: 1800, q: 0.7 }, 0.2);
}

/**
 * Постріл і влучання. `launchPerfMs` — момент запуску анімації (performance.now()): влучання
 * прив'язується саме до візуального прильоту, з поправкою на затримку виходу звуку (Bluetooth тощо),
 * а не до «зараз + політ» — інакше затримка запуску AudioContext зсувала б звук відносно картинки.
 */
export async function playShot(flightSec: number, launchPerfMs: number = performance.now()): Promise<void> {
  const c = context();
  if (!c) return;
  // Поки контекст призупинений, його годинник стоїть: чекаємо запуску, інакше звук відстав би від картинки.
  if (c.state !== "running") {
    await Promise.race([c.resume().catch(() => undefined), new Promise((r) => setTimeout(r, 500))]);
  }
  // завершені постріли з реєстру прибираємо
  const now = performance.now();
  for (let i = flights.length - 1; i >= 0; i--) {
    if (flights[i].launchPerf + Math.max(0.5, flights[i].flightSec) * 1000 <= now) flights.splice(i, 1);
  }
  flights.push({ launchPerf: launchPerfMs, flightSec });
  scheduleFlight(c, launchPerfMs, flightSec, true);
}

// Згортання застосунку (особливо на iPhone) зупиняє годинник аудіо: заплановане влучання «застрягає» і
// лунає після повернення, хоча міна вже долетіла. Тому при згортанні глушимо все, а при поверненні
// дограємо лише ті постріли, що ще справді в польоті.
function onHidden(): void {
  stopAll();
}
async function onVisible(): Promise<void> {
  // Подія «згорнуто» могла не дійти (сторінку заморозили раніше) — глушимо старе й при поверненні.
  stopAll();
  const c = ctx;
  if (!c || muted) return;
  if (c.state !== "running") {
    await Promise.race([c.resume().catch(() => undefined), new Promise((r) => setTimeout(r, 500))]);
  }
  // залишок рахуємо вже після запуску контексту: так час, поки він стояв, не потрапляє в розклад
  const now = performance.now();
  for (let i = flights.length - 1; i >= 0; i--) {
    if (flights[i].launchPerf + Math.max(0.5, flights[i].flightSec) * 1000 <= now) flights.splice(i, 1);
  }
  for (const f of flights) scheduleFlight(c, f.launchPerf, f.flightSec, false);
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => (document.hidden ? onHidden() : void onVisible()));
  window.addEventListener("pagehide", onHidden);
  // iOS інколи повертає застосунок подією pageshow, а не visibilitychange
  window.addEventListener("pageshow", () => void onVisible());
}
