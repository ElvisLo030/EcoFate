export type DayId = "day1" | "day2" | "day3";

export type BranchId = "ivy" | "shino";

export type Operator = "eq" | "gte";

export interface GameContent {
  meta: {
    title: string;
    subtitle: string;
    locale: string;
  };
  points: {
    correct: number;
    wrong: number;
    dayMax: number;
    totalMax: number;
  };
  ui: Record<string, string>;
  characters: Record<string, CharacterContent>;
  days: DayContent[];
  hiddenBranches: HiddenBranchContent[];
  ending: {
    title: string;
    summary: string;
  };
}

export interface CharacterContent {
  displayName: string;
  portrait: string;
  accent: string;
}

export interface DayContent {
  id: DayId;
  order: number;
  title: string;
  theme: string;
  heroine: string;
  stages: StageContent[];
}

export interface StageContent {
  id: string;
  order: number;
  title: string;
  background: string;
  speaker: string;
  dialogue: string;
  situation: string;
  correctOptionId: string;
  options: ChoiceContent[];
  feedback: {
    correct: string;
    wrong: string;
  };
  foreshadow?: {
    branchId: BranchId;
    text: string;
  };
}

export interface ChoiceContent {
  id: string;
  text: string;
}

export interface HiddenBranchContent {
  id: BranchId;
  displayName: string;
  unlockAfterDay: DayId;
  portrait: string;
  conditions: BranchCondition[];
  messages: string[];
}

export type BranchCondition =
  | {
      metric: "dayScore";
      dayId: DayId;
      operator: Operator;
      value: number;
    }
  | {
      metric: "dayScoreSum";
      dayIds: DayId[];
      operator: Operator;
      value: number;
    };

export interface GameState {
  playerName: string;
  currentDayIndex: number;
  currentStageIndex: number;
  dayScores: Record<DayId, number>;
  totalScore: number;
  answeredStageIds: string[];
  selectedAnswers: Record<string, string>;
  unlockedBranches: BranchId[];
  completed: boolean;
  savedAt: number;
}

export interface AnswerResult {
  isCorrect: boolean;
  earnedPoints: number;
  dayCompleted: boolean;
  gameCompleted: boolean;
  unlockedMessages: string[];
}
