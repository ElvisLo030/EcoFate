/**
 * scriptLoader.ts
 * 將 .md 格式劇本解析為 GameContent 結構，在 Astro 建置期執行。
 *
 * MD 對話格式規則：
 * - 行尾有 [BREAK] → 插入 </br> 分段（玩家點擊後繼續）
 * - 相同說話者換行（無 [BREAK]）→ 合併為同一段落，加 \n
 * - 不同說話者切換（前行無 [BREAK]）→ 自動補 </br> 再切換
 * - {playerName} → 保留原樣，runtime 由 replacePlaceholders() 替換
 * - 格式 角色名｜文字 → 轉換為 角色名：文字（配合 parseSegment()）
 */

import type {
  BranchCondition,
  CharacterContent,
  DayContent,
  DayId,
  DayIntroContent,
  DayOutroContent,
  EpilogueContent,
  EndingResultContent,
  GameContent,
  NameDayIntroContent,
  SpRouteContent,
  SpRouteId,
  StageContent,
  StorySceneContent,
} from "./types";

// ─────────────────────────────────────────
// 角色設定（靜態定義，配合 parseSegment()）
// ─────────────────────────────────────────
const CHARACTERS: Record<string, CharacterContent> = {
  system: {
    displayName: "系統",
    portrait: "assets/characters/system.svg",
    accent: "#7bdcb5",
  },
  narration: {
    displayName: "旁白",
    portrait: "assets/characters/user.svg",
    accent: "#c8c8c8",
  },
  kosumi: {
    displayName: "小澄",
    portrait: "assets/characters/kosumi.svg",
    accent: "#F0788C",
  },
  coco: {
    displayName: "可可",
    portrait: "assets/characters/coco.svg",
    accent: "#F4A460",
  },
  player: {
    displayName: "玩家",
    portrait: "assets/characters/user.svg",
    accent: "#ffd6e1",
  },
  hakuon: {
    displayName: "箔音",
    portrait: "assets/characters/hakuon.svg",
    accent: "#F2B035",
  },
  ivy: {
    displayName: "艾薇",
    portrait: "assets/characters/ivy.svg",
    accent: "#F67280",
  },
  shino: {
    displayName: "紙乃",
    portrait: "assets/characters/shino.svg",
    accent: "#4CAF50",
  },
  jinsui: {
    displayName: "金穗",
    portrait: "assets/characters/jin-sui.svg",
    accent: "#FFD700",
  },
  yiyun: {
    displayName: "一雲",
    portrait: "assets/characters/onecloud.svg",
    accent: "#8fd3ff",
  },
  mystery: {
    displayName: "？？？",
    portrait: "assets/characters/system.svg",
    accent: "#b0a0c8",
  },
};

// 顯示名稱 → 角色 key（供 parseSegment 匹配）
const DISPLAY_NAME_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CHARACTERS).map(([key, char]) => [char.displayName, key])
);

// ─────────────────────────────────────────
// 主要 export
// ─────────────────────────────────────────

/**
 * 建置期主入口：將所有 .md 原始文字 + ui.yaml 組合成 GameContent。
 *
 * @param mdFiles   import.meta.glob 取得的路徑 → 原始字串 Map
 * @param uiYamlRaw ui.yaml 原始文字
 */
export function buildGameContent(
  mdFiles: Record<string, string>,
  uiYamlRaw: string
): GameContent {
  const ui = parseUiYaml(uiYamlRaw);

  // 取得歡迎彈窗（優先 Intro.md，其次 welcome.md）
  const welcomeMd = findMd(mdFiles, "script/Intro.md") ?? findMd(mdFiles, "script/welcome.md");
  const welcome = welcomeMd ? parseWelcomeMd(welcomeMd) : undefined;

  // 取得序章（優先 D0.md，其次 prologue.md）
  const prologueMd = findMd(mdFiles, "script/D0.md") ?? findMd(mdFiles, "script/prologue.md");
  const prologue = prologueMd ? parsePrologueMd(prologueMd) : undefined;

  // 建置 5 天主線
  const { days, toBeContinued } = buildDays(mdFiles);

  // 建置 SP 路線
  const spRoutes = buildSpRoutes(mdFiles);

  // 結局文字（ending/ 目錄下的 .md）
  const ending = buildEnding(mdFiles);
  const epilogueMd = findMd(mdFiles, "script/Epilogue.md");
  const epilogue = epilogueMd !== undefined ? parseEpilogueMd(epilogueMd) : undefined;

  return {
    meta: {
      title: "永續回收命運機",
      subtitle: "ESG 消費行為改變遊戲",
      locale: "zh-TW",
    },
    welcome,
    points: {
      correct: 25,
      wrong: 0,
      dayMax: 100,
      totalMax: 500,
      spMax: 100,
    },
    ui,
    characters: CHARACTERS,
    prologue,
    routeRules: {
      endings: [
        // True Ending：主線總分 ≥ 450 且 SP1+SP2 ≥ 75
        {
          id: "true",
          conditions: [
            {
              metric: "dayScoreSum",
              dayIds: ["day1", "day2", "day3", "day4", "day5"],
              operator: "gte",
              value: 450,
            },
            {
              metric: "spScoreSum",
              spIds: ["sp1", "sp2"],
              operator: "gte",
              value: 75,
            },
          ],
        },
        // Good Ending：主線總分 ≥ 400
        {
          id: "good",
          conditions: [
            {
              metric: "dayScoreSum",
              dayIds: ["day1", "day2", "day3", "day4", "day5"],
              operator: "gte",
              value: 400,
            },
          ],
        },
        // Bad Ending：預設（其他情況）
        {
          id: "bad",
          default: true,
          conditions: [],
        },
      ],
    },
    days,
    spRoutes: spRoutes.length > 0 ? spRoutes : undefined,
    toBeContinued,
    epilogue,
    ending,
  };
}

// ─────────────────────────────────────────
// UI YAML 解析（純平面 key: value）
// ─────────────────────────────────────────

function parseUiYaml(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed
      .slice(colonIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) result[key] = value;
  }
  return result;
}

// ─────────────────────────────────────────
// 天數建置
// ─────────────────────────────────────────

const DAY_IDS: DayId[] = ["day1", "day2", "day3", "day4", "day5"];
const DAY_DIRS = ["D1", "D2", "D3", "D4", "D5"];

const DAY_META: Record<
  DayId,
  { title: string; theme: string; heroine: string; background: string }
> = {
  day1: { title: "Day 1", theme: "源頭減量", heroine: "kosumi", background: "club" },
  day2: { title: "Day 2", theme: "寶特瓶回收", heroine: "coco", background: "campus" },
  day3: { title: "Day 3", theme: "複合材質回收", heroine: "hakuon", background: "recycle" },
  day4: { title: "Day 4", theme: "金屬回收", heroine: "jinsui", background: "recycle" },
  day5: { title: "Day 5", theme: "電子發票", heroine: "yiyun", background: "shop" },
};

function buildDays(mdFiles: Record<string, string>): {
  days: DayContent[];
  toBeContinued: StorySceneContent | undefined;
} {
  const days: DayContent[] = [];
  let toBeContinued: StorySceneContent | undefined;

  for (let i = 0; i < DAY_IDS.length; i++) {
    const dayId = DAY_IDS[i];
    const dir = DAY_DIRS[i];
    const meta = DAY_META[dayId];

    // 開場（D1-0.md）
    const openingMd = findMd(mdFiles, `script/${dir}/${dir}-0.md`);
    const intro: DayIntroContent | undefined = openingMd
      ? parseOpeningMd(openingMd, dayId)
      : undefined;

    // 解析關卡（D1-1.md ~ D1-4.md）
    const stages: StageContent[] = [];
    let dayToBeContinued = false;

    for (let s = 1; s <= 4; s++) {
      const stageMd = findMd(mdFiles, `script/${dir}/${dir}-${s}.md`);
      if (!stageMd) {
        // 此關卡文本缺失 → 設定未完待續
        dayToBeContinued = true;
        break;
      }
      const stage = parseStageMd(stageMd, dayId, s);
      stages.push(stage);
    }

    // 至少有開場或一個關卡才算此天存在
    if (!intro && stages.length === 0) {
      // 整天都沒有內容 → 停止建置（後面的天也不需要）
      if (days.length === 0) {
        // 沒有任何天，至少建一個空天避免引擎崩潰
        break;
      }
      // 前幾天有內容，在前一天標記未完待續後停止
      break;
    }

    const outroMd = findMd(mdFiles, `script/${dir}/${dir}-ED.md`);
    const outro: DayOutroContent | undefined =
      stages.length === 4 && outroMd ? parseDayOutroMd(outroMd, dayId) : undefined;

    days.push({
      id: dayId,
      order: i + 1,
      title: meta.title,
      theme: meta.theme,
      heroine: meta.heroine,
      intro,
      outro,
      stages,
    });

    if (dayToBeContinued) {
      // 此天關卡不完整 → 標記未完待續後停止建置後續天數
      toBeContinued = {
        id: `TBC-${dir}`,
        routeLabel: `TBC-${dir}`,
        title: `${meta.title}未完待續`,
        background: meta.background,
        speaker: "system",
        dialogue: `系統：「${meta.title} 的故事即將繼續。」`,
      };
      break;
    }
  }

  // 如果 5 天都完整但仍無 toBeContinued，代表遊戲可能完整
  return { days, toBeContinued };
}

// ─────────────────────────────────────────
// 開場 MD 解析（D1-0.md 格式）
// ─────────────────────────────────────────

function parseOpeningMd(raw: string, dayId: DayId): DayIntroContent {
  const sections = parseSections(raw);
  const meta = parseFileMeta(raw);

  const isD1 = dayId === "day1";
  const dayNum = DAY_IDS.indexOf(dayId) + 1;
  const routeLabel = `D${dayNum}-0`;
  const dayMeta = DAY_META[dayId];
  const title = getTitleFromRaw(raw);

  if (isD1) {
    // D1 開場有暱稱輸入前/後
    const beforeLines = sections["暱稱輸入前"] ?? [];
    const afterLines = sections["暱稱輸入後"] ?? [];

    const result: NameDayIntroContent = {
      id: `${dayNum}-0`,
      routeLabel,
      title,
      background: dayMeta.background,
      speaker: getHeroineKey(meta.heroine),
      beforeNameDialogue: parseDialogueLines(beforeLines),
      namePrompt: {
        placeholder: "請輸入你的暱稱",
        submitButton: "告訴小澄",
      },
      afterNameDialogue: parseDialogueLines(afterLines),
    };
    return result;
  }

  // D2~D5 開場為普通故事場景
  const mainLines = sections["主要內容"] ?? sections["開場"] ?? [];
  const allContentLines: string[] = [];
  for (const [sectionName, lines] of Object.entries(sections)) {
    if (sectionName !== "__meta__") {
      allContentLines.push(...lines);
    }
  }

  const result: StorySceneContent = {
    id: `${dayNum}-0`,
    routeLabel,
    title,
    background: dayMeta.background,
    speaker: getHeroineKey(meta.heroine),
    dialogue: parseDialogueLines(
      mainLines.length > 0 ? mainLines : allContentLines
    ),
  };
  return result;
}

// ─────────────────────────────────────────
// 關卡 MD 解析（D1-1.md 格式）
// ─────────────────────────────────────────

function parseStageMd(raw: string, dayId: DayId, stageOrder: number): StageContent {
  const sections = parseSections(raw);
  const meta = parseFileMeta(raw);

  const dayNum = DAY_IDS.indexOf(dayId) + 1;
  const stageId = `${dayNum}-${stageOrder}`;
  const routeLabel = `D${dayNum}-${stageOrder}`;

  // 選項（### 選項）
  const optionLines = sections["選項"] ?? [];
  const options = parseOptionLines(optionLines, stageId);

  // 正確選項（從 meta 取得，如 "1-1-B"）
  const correctOptionId = parseCorrectOption(meta.correctOption ?? "", stageId, options);

  // 引導對話
  const introLines = sections["引導對話"] ?? [];

  // 各選項回應（### 回應：X）
  const responseDialogues = buildResponseDialogues(sections, options, stageId);

  // 知識點（### 知識點）
  const knowledgeLines = sections["知識點"] ?? [];
  const knowledgePoint = knowledgeLines.map((l) => l.trim()).filter(Boolean).join("") || undefined;

  return {
    id: stageId,
    routeLabel,
    order: stageOrder,
    title: getTitleFromRaw(raw),
    background: DAY_META[dayId].background,
    speaker: getHeroineKey(meta.heroine),
    dialogue: parseDialogueLines(introLines),
    correctOptionId,
    options,
    responseDialogues,
    feedback: {
      correct: "",
      wrong: "",
    },
    knowledgePoint,
  };
}

// ─────────────────────────────────────────
// SP 路線建置
// ─────────────────────────────────────────

const SP_META: Record<
  SpRouteId,
  {
    title: string;
    displayName: string;
    heroine: string;
    unlockAfterDay: DayId;
    unlockCondition: BranchCondition;
    nextDay: DayId;
    background: string;
  }
> = {
  sp1: {
    title: "SP1 隱藏劇情",
    displayName: "SP1",
    heroine: "ivy",
    unlockAfterDay: "day2",
    unlockCondition: { metric: "dayScore", dayId: "day2", operator: "gte", value: 100 },
    nextDay: "day3",
    background: "shop",
  },
  sp2: {
    title: "SP2 隱藏劇情",
    displayName: "SP2",
    heroine: "shino",
    unlockAfterDay: "day4",
    unlockCondition: {
      metric: "dayScoreSum",
      dayIds: ["day1", "day2", "day3", "day4"],
      operator: "gte",
      value: 200,
    },
    nextDay: "day5",
    background: "club",
  },
};

function buildSpRoutes(mdFiles: Record<string, string>): SpRouteContent[] {
  const spRoutes: SpRouteContent[] = [];
  const spIds: SpRouteId[] = ["sp1", "sp2"];
  const spDirs = ["SP1", "SP2"];

  for (let i = 0; i < spIds.length; i++) {
    const spId = spIds[i];
    const dir = spDirs[i];
    const meta = SP_META[spId];

    const triggerMd = findMd(mdFiles, `script/${dir}/${dir}-TR.md`);
    const unlockScene = triggerMd ? parseSpTriggerMd(triggerMd, spId) : undefined;

    const openingFile = spId === "sp1" ? "SP-0" : `${dir}-0`;
    const openingMd = findMd(mdFiles, `script/${dir}/${openingFile}.md`);
    const intro: StorySceneContent | undefined = openingMd
      ? parseSpOpeningMd(openingMd, spId, openingFile)
      : undefined;

    // 關卡（SP1-1.md、SP1-2.md，每個 SP 最多 2 關）
    const stages: StageContent[] = [];
    for (let s = 1; s <= 2; s++) {
      const stageMd = findMd(mdFiles, `script/${dir}/${dir}-${s}.md`);
      if (!stageMd) break;
      const stage = parseSpStageMd(stageMd, spId, s);
      stages.push(stage);
    }

    const outroMd = findMd(mdFiles, `script/${dir}/${dir}-ED.md`);
    const outro = outroMd ? parseSpOutroMd(outroMd, spId) : undefined;

    // 有任何 SP 內容才加入
    if (unlockScene || intro || stages.length > 0 || outro) {
      spRoutes.push({
        id: spId,
        title: meta.title,
        displayName: meta.displayName,
        heroine: meta.heroine,
        unlockAfterDay: meta.unlockAfterDay,
        unlockCondition: meta.unlockCondition,
        nextDay: meta.nextDay,
        unlockScene,
        intro,
        stages,
        outro,
      });
    }
  }

  return spRoutes;
}

function parseSpTriggerMd(raw: string, spId: SpRouteId): StorySceneContent {
  const meta = SP_META[spId];
  return parseStoryMd(raw, `${spId.toUpperCase()}-TR`, `${spId.toUpperCase()}-TR`, meta.background, meta.heroine);
}

function parseSpOpeningMd(raw: string, spId: SpRouteId, routeLabel: string): StorySceneContent {
  const meta = SP_META[spId];
  return parseStoryMd(raw, `${spId.toUpperCase()}-0`, routeLabel, meta.background, meta.heroine);
}

function parseSpOutroMd(raw: string, spId: SpRouteId): StorySceneContent {
  const meta = SP_META[spId];
  return parseStoryMd(raw, `${spId.toUpperCase()}-ED`, `${spId.toUpperCase()}-ED`, meta.background, meta.heroine);
}

function parseStoryMd(
  raw: string,
  id: string,
  routeLabel: string,
  fallbackBackground: string,
  fallbackHeroine: string
): StorySceneContent {
  const sections = parseSections(raw);
  const meta = parseFileMeta(raw);
  const allLines: string[] = [];
  for (const [sectionName, lines] of Object.entries(sections)) {
    if (sectionName !== "__meta__") allLines.push(...lines);
  }

  return {
    id,
    routeLabel,
    title: getTitleFromRaw(raw),
    background: fallbackBackground,
    speaker: getHeroineKey(meta.heroine) ?? fallbackHeroine,
    dialogue: parseDialogueLines(allLines),
  };
}

function parseSpStageMd(raw: string, spId: SpRouteId, order: number): StageContent {
  const sections = parseSections(raw);
  const meta = parseFileMeta(raw);

  const stageId = `${spId.toUpperCase()}-${order}`;
  const routeLabel = stageId;

  const optionLines = sections["選項"] ?? [];
  const options = parseOptionLines(optionLines, stageId);
  const correctOptionId = parseCorrectOption(meta.correctOption ?? "", stageId, options);
  const introLines = sections["引導對話"] ?? [];
  const responseDialogues = buildResponseDialogues(sections, options, stageId);

  // 知識點（### 知識點）
  const knowledgeLines = sections["知識點"] ?? [];
  const knowledgePoint = knowledgeLines.map((l) => l.trim()).filter(Boolean).join("") || undefined;

  return {
    id: stageId,
    routeLabel,
    order,
    title: getTitleFromRaw(raw),
    background: SP_META[spId].background,
    speaker: getHeroineKey(meta.heroine),
    dialogue: parseDialogueLines(introLines),
    correctOptionId,
    options,
    responseDialogues,
    feedback: { correct: "", wrong: "" },
    knowledgePoint,
  };
}

// ─────────────────────────────────────────
// Welcome MD 解析
// ─────────────────────────────────────────

function parseWelcomeMd(raw: string) {
  const sections = parseSections(raw);
  const meta = parseFileMeta(raw);
  const titleMatch = raw.match(/^#\s+(.+)/m);
  const title = titleMatch?.[1]?.trim() ?? "永續回收命運機";

  // 收集所有 section 內容（含 __meta__，以支援純文字格式）
  const bodyLines: string[] = [];
  for (const lines of Object.values(sections)) {
    for (const l of lines) {
      const cleaned = l.replace(/^旁白｜|^系統｜/, "").trimEnd();
      // 過濾 meta 欄位行
      if (/^(背景|主角|正確選項|確認按鈕)：/.test(cleaned.trim())) continue;
      bodyLines.push(cleaned);
    }
  }

  return {
    title,
    body: bodyLines.join("\n").trim(),
    confirmButton: meta.confirmButton ?? "我明白了，開始遊戲",
  };
}

// ─────────────────────────────────────────
// Prologue MD 解析（D0.md 格式：有選項與分支）
// ─────────────────────────────────────────

function parsePrologueMd(raw: string) {
  const sections = parseSections(raw);
  const titleMatch = raw.match(/^#\s+(.+)/m);
  const title = titleMatch?.[1]?.trim() ?? "序章";

  // 引導對話（選項出現前）
  const introLines = sections["引導對話"] ?? [];
  const dialogue = parseDialogueLines(introLines);

  // 選項（### 選項（無積分） 或 ### 選項）
  const optionLines = sections["選項（無積分）"] ?? sections["選項"] ?? [];
  const choices: { id: string; text: string }[] = optionLines
    .map((line) => {
      const match = line.trim().match(/^-\s*([A-Z])｜(.+)$/);
      if (!match) return null;
      return { id: `d0-${match[1]}`, text: match[2].trim() };
    })
    .filter((c): c is { id: string; text: string } => c !== null);

  // 各選項分支對話（### 回應：A 等）
  const branchDialogue: Record<string, string> = {};
  for (const [sectionName, lines] of Object.entries(sections)) {
    if (!sectionName.startsWith("回應：")) continue;
    const lettersStr = sectionName.slice(3).trim();
    const letters = lettersStr.split(/[、,，\s]+/).filter(Boolean);
    const branchText = parseDialogueLines(lines);
    for (const letter of letters) {
      branchDialogue[`d0-${letter.trim()}`] = branchText;
    }
  }

  // 共同結尾（### 共同結尾）
  const endingLines = sections["共同結尾"] ?? [];
  const sharedEnding = parseDialogueLines(endingLines);

  return {
    routeLabel: "D0",
    title,
    background: "club",
    scenes: [
      {
        id: "d0-s0",
        dialogue,
        choices,
        branchDialogue,
        sharedEnding,
      },
    ],
  };
}

// ─────────────────────────────────────────
// 結局建置
// ─────────────────────────────────────────

function buildEnding(mdFiles: Record<string, string>): {
  title: string;
  results: Record<string, EndingResultContent>;
} {
  const goodMd = findMd(mdFiles, "script/ED/Good Ending.md");
  const trueMd = findMd(mdFiles, "script/ED/True Ending.md");
  const badMd = findMd(mdFiles, "script/ED/Bad Ending.md");

  return {
    title: "遊戲成果",
    results: {
      good: goodMd
        ? parseEndingMd(goodMd, "Good Ending")
        : {
            routeLabel: "Good Ending",
            title: "Good Ending",
            dialogue: "系統：「Good Ending」",
            summary: "{playerName} 的環保積分達到 400 分以上，走向 Good Ending。",
          },
      true: trueMd
        ? parseEndingMd(trueMd, "True Ending")
        : {
            routeLabel: "True Ending",
            title: "True Ending",
            dialogue: "系統：「True Ending」",
            summary:
              "{playerName} 的環保積分達到 450 分以上，且隱藏分數達 75 分，走向 True Ending！",
          },
      bad: badMd
        ? parseEndingMd(badMd, "Bad Ending")
        : {
            routeLabel: "Bad Ending",
            title: "Bad Ending",
            dialogue: "系統：「Bad Ending」",
            summary: "{playerName} 的環保積分未達目標，進入 Bad Ending。",
          },
    },
  };
}

function parseEndingMd(raw: string, routeLabel: string): EndingResultContent {
  const titleMatch = raw.match(/^#\s+(.+)/m);
  const title = titleMatch?.[1]?.trim() ?? "結局";
  const sections = parseSections(raw);
  const lines: string[] = [];
  for (const [sectionName, sectionLines] of Object.entries(sections)) {
    if (sectionName !== "__meta__") lines.push(...sectionLines);
  }
  if (lines.length === 0) {
    lines.push(...(sections.__meta__ ?? []).filter((line) => !isMetaFieldLine(line)));
  }
  return {
    routeLabel,
    title,
    dialogue: parseDialogueLines(lines),
    summary: parseDialogueLines(lines).replaceAll("</br>", "\n\n"),
  };
}

function isMetaFieldLine(line: string): boolean {
  return /^(背景|主角|正確選項|確認按鈕)：/.test(line.trim());
}

function parseEpilogueMd(raw: string): EpilogueContent {
  const title = getTitleFromRaw(raw, "結語");
  const sections = parseSections(raw);
  const lines: string[] = [];
  for (const [sectionName, sectionLines] of Object.entries(sections)) {
    if (sectionName !== "__meta__") lines.push(...sectionLines);
  }
  if (lines.length === 0) {
    lines.push(...(sections.__meta__ ?? []).filter((line) => !isMetaFieldLine(line)));
  }

  const dialogue = parseDialogueLines(lines);

  return {
    routeLabel: "Epilogue",
    title,
    dialogue: dialogue || "系統：結語尚未撰寫。",
    summary: dialogue ? dialogue.replaceAll("</br>", "\n\n") : "結語尚未撰寫。",
  };
}

function parseDayOutroMd(raw: string, dayId: DayId): DayOutroContent {
  const meta = parseFileMeta(raw);
  const dayNum = DAY_IDS.indexOf(dayId) + 1;
  const routeLabel = `D${dayNum}-ED`;
  const highLines = findSectionByPrefix(parseSections(raw), "高分結局");
  const defaultLines = findSectionByPrefix(parseSections(raw), "預設結局");

  return {
    id: `${dayNum}-ED`,
    routeLabel,
    title: getTitleFromRaw(raw),
    background: DAY_META[dayId].background,
    speaker: getHeroineKey(meta.heroine) ?? DAY_META[dayId].heroine,
    branches: [
      {
        id: `${dayNum}-ED-A`,
        condition: {
          metric: "dayScore",
          dayId,
          operator: "gt",
          value: 50,
        },
        dialogue: parseDialogueLines(highLines),
      },
      {
        id: `${dayNum}-ED-B`,
        default: true,
        dialogue: parseDialogueLines(defaultLines),
      },
    ],
  };
}

// ─────────────────────────────────────────
// MD 對話解析核心
// ─────────────────────────────────────────

/**
 * 將對話行陣列轉換為 game.ts 使用的 </br> 分隔字串。
 *
 * 規則：
 * 1. 行尾有 [BREAK] → 此行結束後插入 </br>
 * 2. 相同說話者，無 [BREAK] → 合併入同一段落（加 \n）
 * 3. 不同說話者，前行無 [BREAK] → 自動補 </br> 再切換
 */
function parseDialogueLines(lines: string[]): string {
  interface Beat {
    speaker: string; // 顯示名稱（已轉換為「角色名：」格式）
    text: string;
    hasBreak: boolean;
  }

  const beats: Beat[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const hasBreak = trimmed.endsWith("[BREAK]");
    const lineContent = hasBreak ? trimmed.slice(0, -7).trim() : trimmed;

    // 解析 角色名｜文字 格式
    const pipeIdx = lineContent.indexOf("｜");
    let speaker = "";
    let text = lineContent;

    if (pipeIdx !== -1) {
      speaker = lineContent.slice(0, pipeIdx).trim();
      text = lineContent.slice(pipeIdx + 1).trim();
    }

    beats.push({ speaker, text, hasBreak });
  }

  // 合併 beats 為 segments（依 [BREAK] 和說話者切換分段）
  const segments: string[] = [];
  let currentSpeaker = "";
  let currentLines: string[] = [];

  function flushSegment() {
    if (currentLines.length === 0) return;
    const speakerPrefix = currentSpeaker ? `${currentSpeaker}：` : "";
    segments.push(speakerPrefix + currentLines.join("\n"));
    currentLines = [];
  }

  for (const beat of beats) {
    const speakerChanged = beat.speaker !== currentSpeaker;

    if (speakerChanged && currentLines.length > 0) {
      // 前一個說話者的行未結束 → 自動補 BREAK（新說話者自動分段）
      flushSegment();
      currentSpeaker = beat.speaker;
    } else if (speakerChanged) {
      currentSpeaker = beat.speaker;
    }

    currentLines.push(beat.text);

    if (beat.hasBreak) {
      flushSegment();
    }
  }

  // 最後一個未以 [BREAK] 結束的段落也需輸出
  if (currentLines.length > 0) {
    flushSegment();
  }

  return segments.join("</br>");
}

// ─────────────────────────────────────────
// 選項解析
// ─────────────────────────────────────────

function parseOptionLines(lines: string[], stageId: string): { id: string; text: string }[] {
  const options: { id: string; text: string }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // 格式：- A｜選項文字
    const match = trimmed.match(/^-\s*([A-D])｜(.+)$/);
    if (!match) continue;
    const letter = match[1];
    const text = match[2].trim();
    options.push({ id: `${stageId}-${letter}`, text });
  }
  return options;
}

/**
 * 解析正確選項 ID。
 * meta 格式：「1-1-B」→ stageId = "1-1"，letter = "B"
 */
function parseCorrectOption(
  metaValue: string,
  stageId: string,
  options: { id: string; text: string }[]
): string {
  if (!metaValue) {
    return options[0]?.id ?? `${stageId}-A`;
  }

  // 從末尾取字母部分
  const parts = metaValue.split("-");
  const letter = parts[parts.length - 1];
  if (letter && /^[A-D]$/.test(letter)) {
    return `${stageId}-${letter}`;
  }

  return options[0]?.id ?? `${stageId}-A`;
}

/**
 * 建置各選項的回應對話 Map。
 * 例如 ### 回應：A、C → 同一段對話對應到 1-1-A 和 1-1-C。
 */
function buildResponseDialogues(
  sections: Record<string, string[]>,
  _options: { id: string; text: string }[],
  stageId: string
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [sectionName, lines] of Object.entries(sections)) {
    if (!sectionName.startsWith("回應：")) continue;

    const lettersStr = sectionName.slice(3).trim(); // "B" 或 "A、C"
    const letters = lettersStr.split(/[、,，\s]+/).filter(Boolean);
    const dialogue = parseDialogueLines(lines);

    for (const letter of letters) {
      const optionId = `${stageId}-${letter.trim()}`;
      result[optionId] = dialogue;
    }
  }

  return result;
}

// ─────────────────────────────────────────
// MD 結構解析輔助
// ─────────────────────────────────────────

/**
 * 將 MD 原始文字切割為各段落（以 ### 為分隔）。
 * 回傳 Record<sectionName, lines[]>
 */
function parseSections(raw: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  let currentSection = "__meta__";
  result[currentSection] = [];

  for (const line of raw.split("\n")) {
    const heading = parseSectionHeading(line);
    if (heading) {
      currentSection = heading;
      result[currentSection] = [];
    } else if (!line.startsWith("# ")) {
      result[currentSection]?.push(line);
    }
  }

  return result;
}

function parseSectionHeading(line: string): string | null {
  const trimmed = line.trim();
  const markdownHeading = trimmed.match(/^#{2,6}\s+(.+)$/);
  if (markdownHeading) {
    return markdownHeading[1].trim();
  }

  const bareHeading = trimmed.match(
    /^(引導對話|開場對話|暱稱輸入前|暱稱輸入後|選項(?:（無積分）)?|回應：.+|共同結尾|知識點|高分結局.*|預設結局|結局|場景)$/
  );
  return bareHeading ? bareHeading[1].trim() : null;
}

function findSectionByPrefix(
  sections: Record<string, string[]>,
  prefix: string
): string[] {
  const entry = Object.entries(sections).find(([name]) => name.startsWith(prefix));
  return entry?.[1] ?? [];
}

/**
 * 從 MD 標題行（#）與 meta 區段（背景：、主角：、正確選項：）取得後設資料。
 */
function parseFileMeta(raw: string): {
  background?: string;
  heroine?: string;
  correctOption?: string;
  confirmButton?: string;
} {
  const meta: {
    background?: string;
    heroine?: string;
    correctOption?: string;
    confirmButton?: string;
  } = {};

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("背景：")) {
      meta.background = trimmed.slice(3).trim();
    } else if (trimmed.startsWith("主角：")) {
      meta.heroine = trimmed.slice(3).trim();
    } else if (trimmed.startsWith("正確選項：")) {
      meta.correctOption = trimmed.slice(5).trim();
    } else if (trimmed.startsWith("確認按鈕：")) {
      meta.confirmButton = trimmed.slice(5).trim();
    }
  }

  return meta;
}

function getTitleFromRaw(raw: string, fallback = "關卡"): string {
  const match = raw.match(/^#\s+(.+)/m);
  return match?.[1]?.trim() ?? fallback;
}

function getHeroineKey(heroineDisplayName?: string): string | undefined {
  if (!heroineDisplayName) return undefined;
  return DISPLAY_NAME_MAP[heroineDisplayName] ?? undefined;
}

/**
 * 在 mdFiles Map 中尋找路徑包含 suffix 的檔案。
 * Vite 的 import.meta.glob 路徑通常是 /src/data/... 形式。
 */
function findMd(
  mdFiles: Record<string, string>,
  suffix: string
): string | undefined {
  const normalizedSuffix = suffix.replace(/\\/g, "/");
  for (const [path, content] of Object.entries(mdFiles)) {
    if (path.replace(/\\/g, "/").endsWith(normalizedSuffix)) {
      return content;
    }
  }
  return undefined;
}
