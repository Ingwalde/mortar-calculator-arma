/** Дрібні SVG-піктограми для списків (розмітка статична, без введеного користувачем тексту). */
const ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

/** Приціл: коло з крапкою й рисками. */
const TARGET = `<svg ${ATTRS} stroke-width="2.4"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/></svg>`;

/** Зруйнована будівля: стіни з обваленим дахом, тріщина й уламки. */
const RUINED_BUILDING = `<svg ${ATTRS} stroke-width="2"><path d="M3 21h18"/><path d="M5 21V6h6l2 4 2-2 2 5v8"/><path d="M9.5 21v-4l2-2"/><path d="M20 17.5h.01M21 20h.01" stroke-width="2.6"/></svg>`;

function make(markup: string): SVGElement {
  const tpl = document.createElement("template");
  tpl.innerHTML = markup;
  return tpl.content.firstElementChild as SVGElement;
}

export const targetIcon = (): SVGElement => make(TARGET);
export const ruinedBuildingIcon = (): SVGElement => make(RUINED_BUILDING);
