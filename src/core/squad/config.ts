/** Адреса реле й запрошення в відділення. */
export const RELAY_URL = "https://mortar-tablet-relay.gdimas0603.workers.dev";

const SITE = "https://ingwalde.github.io/mortar-tablet/";

/** Посилання-запрошення: код у фрагменті адреси (браузер не надсилає фрагмент на сервер). */
export function inviteLink(room: string, code: string, base: string = SITE): string {
  return `${base}#squad=${room}.${code}`;
}

export interface Invite {
  room: string;
  code: string;
}

/** Розбирає запрошення з адреси, фрагмента (`#squad=…`) або голого `<кімната>.<код>`. */
export function parseInvite(text: string): Invite | null {
  const m = /(?:squad=)?\b([0-9a-f]{32})\.([0-9a-f]{32})\b/i.exec(text.trim());
  return m ? { room: m[1].toLowerCase(), code: m[2].toLowerCase() } : null;
}

/** Адреса сокета кімнати. */
export function socketUrl(room: string, relay: string = RELAY_URL): string {
  return relay.replace(/^http/, "ws") + "/ws/" + room;
}
