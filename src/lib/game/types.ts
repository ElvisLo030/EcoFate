export type DayId = "day1" | "day2";

export type BranchId = "ivy" | "shino";
export type HiddenRouteId = "h2";

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
  title: string;
  background: string;
  speaker?: string;
  dialogue: string;
}

export interface NameDayIntroContent {
  id: string;
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
  specialRoutes?: SpecialRouteContent[];
  endings: EndingRouteRuleContent[];
}

export interface SpecialRouteContent {
  id: string;
  unlockAfterDay: DayId;
  condition: BranchCondition;
  nextDay: DayId;
}

export interface EndingRouteRuleContent {
  id: string;
  condition: BranchCondition;
}

export interface EndingResultContent {
  title: string;
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
  };
  ui: Record<string, string>;
  characters: Record<string, CharacterContent>;
  prologue?: PrologueContent;
  routeRules?: RouteRulesContent;
  days: DayContent[];
  hiddenRoutes?: HiddenRouteContent[];
  hiddenBranches: HiddenBranchContent[];
  toBeContinued?: StorySceneContent;
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

export interface HiddenRouteContent {
  id: HiddenRouteId;
  title: string;
  displayName: string;
  heroine: string;
  unlockAfterDay: DayId;
  unlockCondition: BranchCondition;
  unlockScene: StorySceneContent;
  intro: StorySceneContent;
  stages: StageContent[];
  outro: StorySceneContent;
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
  branchScores: Record<HiddenRouteId, number>;
  totalScore: number;
  answeredStageIds: string[];
  selectedAnswers: Record<string, string>;
  unlockedBranches: BranchId[];
  pendingHiddenRouteId: HiddenRouteId | null;
  currentHiddenRouteId: HiddenRouteId | null;
  currentHiddenStageIndex: number;
  completedIntros: DayId[];
  completedOutros: DayId[];
  completedHiddenRouteIntros: HiddenRouteId[];
  completedHiddenRoutes: HiddenRouteId[];
  toBeContinued: boolean;
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
