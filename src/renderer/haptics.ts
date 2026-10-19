/**
 * Тактильний відгук. Android і ПК: Vibration API. iPhone: WebKit його не реалізує зовсім, але Safari 17.4+ дає
 * легкий «тик», коли перемикається прихований <input type="checkbox" switch>; клік має йти з жесту користувача
 * (натискання кнопки), тому з таймерів і фонових подій на iOS нічого не відчути.
 */
const IS_IOS = typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

let tickLabel: HTMLLabelElement | null = null;
function iosTick(): void {
  try {
    if (!tickLabel) {
      tickLabel = document.createElement("label");
      tickLabel.setAttribute("aria-hidden", "true");
      tickLabel.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      tickLabel.appendChild(input);
      document.body.appendChild(tickLabel);
    }
    tickLabel.click();
  } catch {
    // немає такої можливості — просто без відгуку
  }
}

/** Чи є хоч якийсь спосіб дати тактильний відгук на цьому пристрої. */
export function canVibrate(): boolean {
  return typeof navigator.vibrate === "function" || IS_IOS;
}

/** iPhone: вібрації нема, лише короткий тик (обмеження iOS). */
export function isIosHaptics(): boolean {
  return IS_IOS && typeof navigator.vibrate !== "function";
}

/** Відгук тривалістю ~ms: вібрація, а на iPhone — один тик (для довшого — два). */
export function vibrate(ms: number): void {
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(ms);
    return;
  }
  if (!IS_IOS) return;
  iosTick();
  if (ms >= 40) setTimeout(iosTick, 90);
}
