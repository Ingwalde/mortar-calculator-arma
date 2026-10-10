/**
 * Телефон не гасить екран, поки планшет відкритий (на полі екран, що гасне, дратує).
 * Wake Lock API є лише в безпечному контексті (https/localhost), а сторінка йде з LAN по http,
 * тому nosleep.js сам падає на запасний шлях — прихований відеоелемент, що грає в циклі.
 * Обидва вимагають жесту користувача: вмикаємо на першому дотику й повертаємо після того, як
 * сторінка була прихована (система знімає блокування).
 */
import NoSleep from "nosleep.js/dist/NoSleep.min.js";
import { isRemote } from "./platform";

export function initWakeLock(): void {
  if (!isRemote) return;

  const noSleep = new NoSleep();
  let active = false;
  let pending = false;

  const enable = async (): Promise<void> => {
    if (active || pending) return;
    pending = true;
    try {
      await noSleep.enable();
      active = true;
    } catch {
      // браузер відмовив (нема жесту / заборонено) — спробуємо при наступному дотику
      active = false;
    } finally {
      pending = false;
    }
  };

  window.addEventListener("pointerdown", () => void enable(), { passive: true });
  window.addEventListener("keydown", () => void enable());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      active = false;
      try {
        noSleep.disable();
      } catch {
        // немає що вимикати
      }
    }
  });
}
