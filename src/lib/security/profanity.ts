import { Filter } from "bad-words";

const MAX_NICKNAME_LENGTH = 16;
const FALLBACK_BLOCKLIST = ["髒話", "垃圾話"];
const filter = new Filter();

export interface NicknameResult {
  ok: boolean;
  value: string;
  error?: string;
}

export function sanitizeNickname(input: string): NicknameResult {
  const normalized = input.trim().replace(/\s+/g, " ");

  if (normalized.length < 1) {
    return {
      ok: false,
      value: "",
      error: "請輸入玩家名稱。"
    };
  }

  if (normalized.length > MAX_NICKNAME_LENGTH) {
    return {
      ok: false,
      value: "",
      error: `玩家名稱最多 ${MAX_NICKNAME_LENGTH} 個字。`
    };
  }

  if (hasProfanity(normalized)) {
    return {
      ok: false,
      value: "",
      error: "玩家名稱含有不適合公開排行榜的文字。"
    };
  }

  return {
    ok: true,
    value: normalized
  };
}

function hasProfanity(value: string): boolean {
  const lowered = value.toLowerCase();
  return filter.isProfane(value) || FALLBACK_BLOCKLIST.some((word) => lowered.includes(word));
}
