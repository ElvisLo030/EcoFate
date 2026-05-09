import { Filter } from "bad-words";

export const MAX_NICKNAME_LENGTH = 16;
export type NicknameErrorCode = "empty" | "tooLong" | "profane";

const FALLBACK_BLOCKLIST = ["髒話", "垃圾話"];
const filter = new Filter();

export interface NicknameResult {
  ok: boolean;
  value: string;
  errorCode?: NicknameErrorCode;
}

export function sanitizeNickname(input: string): NicknameResult {
  const normalized = input.trim().replace(/\s+/g, " ");

  if (normalized.length < 1) {
    return { ok: false, value: "", errorCode: "empty" };
  }

  if (normalized.length > MAX_NICKNAME_LENGTH) {
    return { ok: false, value: "", errorCode: "tooLong" };
  }

  if (hasProfanity(normalized)) {
    return { ok: false, value: "", errorCode: "profane" };
  }

  return { ok: true, value: normalized };
}

function hasProfanity(value: string): boolean {
  const lowered = value.toLowerCase();
  return filter.isProfane(value) || FALLBACK_BLOCKLIST.some((word) => lowered.includes(word));
}
