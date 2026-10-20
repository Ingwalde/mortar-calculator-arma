/** Application terms and third-party notices, included in every renderer build. */
import license from "../../LICENSE?raw";
import notices from "../../THIRD-PARTY-NOTICES.md?raw";
import packageNotices from "../../resources/legal/npm-notices.txt?raw";

export const NOTICES_TEXT: string = `${license}\n\n${notices}\n\n${packageNotices}`;
