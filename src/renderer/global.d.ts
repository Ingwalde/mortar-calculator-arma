/// <reference types="vite/client" />
import type { MortarApi } from "../preload/index";

declare global {
  interface Window {
    api: MortarApi;
  }
  /** Версія застосунку з package.json (підставляється збіркою; ім'я service worker-а для скидання кешу). */
  const __APP_VERSION__: string;
}

export {};
