/**
 * Умовні знаки міток у стилі НАТО APP-6: рамка за приналежністю (свій: блакитний прямокутник, чужий: червоний ромб) і символ усередині.
 * Піхота: перехрещені лінії; броня: гусеничний овал; міномет і гелікоптер: силует збоку; відступ: товстий хрестик без рамки.
 * Малюнки власні (рядки SVG без залежностей); лінії жирні, щоб знак читався розміром 30 px на темній і світлій місцевості.
 */
import type { Affiliation, MarkKind } from "./marks";

const FRIEND_FILL = "#80E0FF";
const HOSTILE_FILL = "#FF8080";
const LEGACY_FILL = "#b2a3d8";
const RETREAT_FRIEND = "#2f6fb4";
const RETREAT_HOSTILE = "#d63b3b";

const LINE = 'stroke="#000" fill="none" stroke-linecap="round" stroke-linejoin="round"';

function frame(aff: Affiliation): string {
  return aff === "friend"
    ? `<rect x="9" y="21" width="82" height="58" fill="${FRIEND_FILL}" stroke="#000" stroke-width="6"/>`
    : `<path d="M50 5L95 50L50 95L5 50Z" fill="${HOSTILE_FILL}" stroke="#000" stroke-width="6"/>`;
}

/** Символ усередині рамки; у ромба менше місця, тож малюнок стискається до центру. */
function glyph(aff: Affiliation, body: string, hostileScale: number): string {
  if (aff === "friend") return body;
  return `<g transform="translate(50 50) scale(${hostileScale}) translate(-50 -50)">${body}</g>`;
}

const INFANTRY_FRIEND = `<path d="M10 22L90 78M90 22L10 78" ${LINE} stroke-width="6"/>`;
const INFANTRY_HOSTILE = `<path d="M30 30L70 70M70 30L30 70" ${LINE} stroke-width="6"/>`;
const ARMOUR = `<rect x="26" y="37" width="48" height="26" rx="13" ${LINE} stroke-width="6.5"/>`;
const MORTAR = `<path d="M36 69L60 32" ${LINE} stroke-width="9"/><path d="M27 75H52" ${LINE} stroke-width="6"/><path d="M55 48L66 75M55 48L78 75" ${LINE} stroke-width="5"/><circle cx="60" cy="32" r="4.5" fill="#000"/>`;
const HELICOPTER = `<ellipse cx="44" cy="54" rx="16" ry="10" ${LINE} stroke-width="6"/><path d="M58 52L80 46M80 46L82 37" ${LINE} stroke-width="6"/><circle cx="82" cy="42" r="4.5" ${LINE} stroke-width="4"/><path d="M23 37H67M45 37V45" ${LINE} stroke-width="6"/><path d="M31 68H59M38 63V68M52 63V68" ${LINE} stroke-width="5"/>`;

function retreat(aff: Affiliation): string {
  const c = aff === "friend" ? RETREAT_FRIEND : RETREAT_HOSTILE;
  const d = "M22 22L78 78M78 22L22 78";
  return `<path d="${d}" stroke="#000" stroke-width="20" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${c}" stroke-width="12" stroke-linecap="round" fill="none"/>`;
}

/** Повний SVG знака (viewBox 100×100). Стара довільна точка (без приналежності) — маленька крапка. */
export function symbolSvg(aff: Affiliation | undefined, kind: MarkKind): string {
  let inner: string;
  if (!aff || kind === "legacy") {
    inner = `<circle cx="50" cy="50" r="20" fill="${LEGACY_FILL}" stroke="#000" stroke-width="6"/>`;
  } else if (kind === "retreat") {
    inner = retreat(aff);
  } else {
    const body =
      kind === "infantry"
        ? aff === "friend"
          ? INFANTRY_FRIEND
          : INFANTRY_HOSTILE
        : kind === "armour"
          ? glyph(aff, ARMOUR, 0.84)
          : kind === "mortar"
            ? glyph(aff, MORTAR, 0.82)
            : glyph(aff, HELICOPTER, 0.74);
    inner = frame(aff) + body;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`;
}

export function symbolKey(aff: Affiliation | undefined, kind: MarkKind): string {
  return `${aff ?? "-"}:${kind}`;
}
