export type DayId = "day1" | "day2" | "day3" | "day4" | "day5";
export type SpRouteId = "sp1" | "sp2";

export type Operator = "eq" | "gt" | "gte" | "lt";

export interface WelcomeContent {
  title: string;
  body: string;
  confirmButton: string;
}

export interface PrologueChoice {
  id: string;
  text: string;
}

export interface PrologueScene {
  id: string;
  dialogue: string;
  choices: PrologueChoice[];
  branchDialogue: Record<string, string>;
  sharedEnding: string;
}

export interface PrologueContent {
  routeLabel: string;
  title: string;
  background: string;
  scenes: PrologueScene[];
}

export interface NamePromptContent {
  placeholder: string;
  submitButton: string;
}

export interface StorySceneContent {
  id: string;
  routeLabel: string;
  title: string;
  background: string;
  speaker?: string;
  dialogue: string;
}

export interface NameDayIntroContent {
  id: string;
  routeLabel: string;
  title: string;
  background: string;
  speaker?: string;
  beforeNameDialogue: string;
  namePrompt: NamePromptContent;
  afterNameDialogue: string;
}

export type DayIntroContent = NameDayIntroContent | StorySceneContent;

export interface DayOutroContent {
  id: string;
  routeLabel: string;
  title: string;
  background: string;
  speaker?: string;
  branches: DayOutroBranchContent[];
}

export type DayOutroBranchContent =
  | {
      id: string;
      condition: BranchCondition;
      default?: false;
      dialogue: string;
    }
  | {
      id: string;
      default: true;
      condition?: never;
      dialogue: string;
    };

export interface RouteRulesContent {
  spRoutes?: SpUnlockRuleContent[];
  endings: EndingRouteRuleContent[];
}

// SP 路線解鎖規則依 rule.md：D2 後判斷 SP1、D4 後判斷 SP2。
export interface SpUnlockRuleContent {
  spId: SpRouteId;
  unlockAfterDay: DayId;
  condition: BranchCondition;
  nextDay: DayId;
}

export interface EndingRouteRuleContent {
  id: string;
  default?: boolean;
  // 複合 AND 條件（全部成立才觸發）
  conditions: BranchCondition[];
}

export interface EndingResultContent {
  routeLabel: string;
  title: string;
  dialogue: string;
  summary: string;
}

export interface EpilogueContent {
  routeLabel: string;
  title: string;
  dialogue: string;
  summary: string;
}

export interface GameContent {
  meta: {
    title: string;
    subtitle?: string;
    locale: string;
  };
  welcome?: WelcomeContent;
  points: {
    correct: number;
    wrong: number;
    dayMax: number;
    totalMax: number;
    spMax: number;
  };
  ui: Record<string, string>;
  characters: Record<string, CharacterContent>;
  prologue?: PrologueContent;
  routeRules?: RouteRulesContent;
  days: DayContent[];
  spRoutes?: SpRouteContent[];
  toBeContinued?: StorySceneContent;
  epilogue?: EpilogueContent;
  ending: {
    title: string;
    results: Record<string, EndingResultContent>;
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
  intro?: DayIntroContent;
  outro?: DayOutroContent;
  stages: StageContent[];
}

export interface StageContent {
  id: string;
  routeLabel: string;
  order: number;
  title: string;
  background: string;
  speaker?: string;
  dialogue: string;
  situation?: string;
  correctOptionId: string;
  options: ChoiceContent[];
  responseDialogues?: Record<string, string>;
  feedback: {
    correct: string;
    wrong: string;
  };
  knowledgePoint?: string;
}

export interface ChoiceContent {
  id: string;
  text: string;
}

// SP 路線（SP1、SP2 隱藏劇情，分數獨立計算）
export interface SpRouteContent {
  id: SpRouteId;
  title: string;
  displayName: string;
  heroine: string;
  unlockAfterDay: DayId;
  unlockCondition: BranchCondition;
  nextDay: DayId;
  unlockScene?: StorySceneContent;
  intro?: StorySceneContent;
  stages: StageContent[];
  outro?: StorySceneContent;
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
    }
  | {
      metric: "spScoreSum";
      spIds: SpRouteId[];
      operator: Operator;
      value: number;
    };

export interface GameState {
  playerName: string;
  currentDayIndex: number;
  currentStageIndex: number;
  dayScores: Record<DayId, number>;
  spScores: Record<SpRouteId, number>;
  totalScore: number;
  answeredStageIds: string[];
  selectedAnswers: Record<string, string>;
  pendingSpRouteId: SpRouteId | null;
  currentSpRouteId: SpRouteId | null;
  currentSpStageIndex: number;
  completedIntros: DayId[];
  completedOutros: DayId[];
  completedSpRouteIntros: SpRouteId[];
  completedSpRoutes: SpRouteId[];
  toBeContinued: boolean;
  completed: boolean;
  completedEnding: boolean;
  completedEpilogue: boolean;
  startedAt: number;
  completedAt: number | null;
  savedAt: number;
}

export interface AnswerResult {
  isCorrect: boolean;
  earnedPoints: number;
  dayCompleted: boolean;
  gameCompleted: boolean;
  unlockedSpRouteId: SpRouteId | null;
}
