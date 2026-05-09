import { createInitialState } from "./engine";
import type { GameState } from "./types";

const STORAGE_KEY = "hackathon-esg-avg-save";

interface StoredPayload {
  state: GameState;
  checksum: string;
}

export function saveGameState(state: GameState): void {
  const payload: StoredPayload = {
    state,
    checksum: createChecksum(state)
  };

  localStorage.setItem(STORAGE_KEY, encodePayload(payload));
}

export function loadGameState(): GameState | null {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    const payload = decodePayload<StoredPayload>(stored);
    if (payload.checksum !== createChecksum(payload.state)) {
      clearGameState();
      return null;
    }

    return payload.state;
  } catch {
    clearGameState();
    return null;
  }
}

export function resetGameState(playerName: string): GameState {
  const state = createInitialState(playerName);
  saveGameState(state);
  return state;
}

export function clearGameState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function encodePayload(payload: StoredPayload): string {
  const raw = JSON.stringify(payload);
  return btoa(encodeURIComponent(raw));
}

function decodePayload<T>(value: string): T {
  return JSON.parse(decodeURIComponent(atob(value))) as T;
}

function createChecksum(state: GameState): string {
  const source = `${state.playerName}|${state.totalScore}|${state.answeredStageIds.join(",")}|${state.savedAt}`;
  // 使用 Base64 加時間戳做輕量混淆，只防止一般玩家誤改 localStorage，不作為真正資安邊界。
  return btoa(encodeURIComponent(source)).slice(0, 24);
}
