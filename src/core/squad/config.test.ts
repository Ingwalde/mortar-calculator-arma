import { describe, expect, it } from "vitest";
import { inviteLink, parseInvite, socketUrl } from "./config";

const room = "a".repeat(32);
const code = "0123456789abcdef".repeat(2);

describe("запрошення", () => {
  it("посилання читається назад з адреси, фрагмента й голого рядка", () => {
    const link = inviteLink(room, code);
    expect(link.startsWith("https://ingwalde.github.io/mortar-tablet/#squad=")).toBe(true);
    expect(parseInvite(link)).toEqual({ room, code });
    expect(parseInvite("#squad=" + room + "." + code)).toEqual({ room, code });
    expect(parseInvite(`  ${room}.${code}  `)).toEqual({ room, code });
  });
  it("сміття й короткі коди відкидаються", () => {
    expect(parseInvite("hello")).toBeNull();
    expect(parseInvite("#squad=abc.def")).toBeNull();
    expect(parseInvite("")).toBeNull();
  });
  it("адреса сокета", () => {
    expect(socketUrl(room, "https://x.example")).toBe("wss://x.example/ws/" + room);
  });
});
