export const MAX_NICKNAME_LENGTH = 10;
export type NicknameErrorCode = "empty" | "tooLong";

export interface NicknameResult {
  ok: boolean;
  value: string;
  errorCode?: NicknameErrorCode;
}

export function normalizeNickname(input: string): NicknameResult {
  const normalized = input.trim().replace(/\s+/g, " ");

  if (normalized.length < 1) {
    return { ok: false, value: "", errorCode: "empty" };
  }

  if (normalized.length > MAX_NICKNAME_LENGTH) {
    return { ok: false, value: "", errorCode: "tooLong" };
  }

  return { ok: true, value: normalized };
}
