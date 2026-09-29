import type { MortarApi } from "../preload/index";

declare global {
  interface Window {
    api: MortarApi;
  }
}

export {};
