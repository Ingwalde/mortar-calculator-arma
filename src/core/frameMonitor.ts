/**
 * Монітор плавності: збирає інтервали між кадрами під час руху карти й каже, чи варто вмикати економний
 * режим. Чиста логіка без DOM — тестується напряму.
 */
export class FrameMonitor {
  private deltas: number[] = [];
  private lastT = 0;

  constructor(
    /** Мінімум вимірів для рішення. */
    private readonly minSamples = 30,
    /** Медіана інтервалу (мс), вище якої вважаємо, що карта гальмує (~33 кадр/с). */
    private readonly slowMedianMs = 30,
    /** Інтервали довші за це (пауза між жестами) у вибірку не беруться. */
    private readonly maxGapMs = 250,
    private readonly windowSize = 40
  ) {}

  /** Реєструє кадр у момент `now`; `moving` — чи змінився вид у цьому кадрі. Повертає true, якщо варто економити. */
  frame(now: number, moving: boolean): boolean {
    let slow = false;
    if (moving) {
      if (this.lastT && now - this.lastT < this.maxGapMs) {
        this.deltas.push(now - this.lastT);
        if (this.deltas.length > this.windowSize) this.deltas.shift();
        if (this.deltas.length >= this.minSamples) {
          const sorted = [...this.deltas].sort((a, b) => a - b);
          slow = sorted[Math.floor(sorted.length / 2)] > this.slowMedianMs;
        }
      }
    }
    this.lastT = now;
    return slow;
  }

  reset(): void {
    this.deltas = [];
    this.lastT = 0;
  }
}
