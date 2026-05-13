import { createInitialState } from "./engine";
import type { GameState } from "./types";

const STORAGE_KEY = "hackathon-esg-avg-save-v2";

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
  // 清除舊版 v1 存檔（與新型別不相容）
  localStorage.removeItem("hackathon-esg-avg-save");

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
  localStorage.removeItem("hackathon-esg-avg-save");
}

function encodePayload(payload: StoredPayload): string {
  const raw = JSON.stringify(payload);
  return btoa(encodeURIComponent(raw));
}

function decodePayload<T>(value: string): T {
  return JSON.parse(decodeURIComponent(atob(value))) as T;
}

function createChecksum(state: GameState): string {
  const spScore = state.spScores
    ? Object.values(state.spScores).join(",")
    : "";
  const routeState = [
    state.pendingSpRouteId ?? "",
    state.currentSpRouteId ?? "",
    state.currentSpStageIndex ?? 0,
    state.toBeContinued ? "tbc" : "",
    state.completedEnding ? "ending" : "",
    state.completedEpilogue ? "epilogue" : "",
    state.startedAt ?? "",
    state.completedAt ?? ""
  ].join(",");
  const source = `${state.playerName}|${state.totalScore}|${spScore}|${state.answeredStageIds.join(",")}|${routeState}|${state.savedAt}`;
  // 輕量混淆，防止一般玩家誤改 localStorage
  return btoa(encodeURIComponent(source)).slice(0, 24);
}
