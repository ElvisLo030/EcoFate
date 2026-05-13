import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const scriptRoot = path.join(process.cwd(), "src/data/i18n/zh-TW/script");
const errors = [];

const mainDays = ["D1", "D2", "D3", "D4", "D5"];
const mainStageFiles = mainDays.flatMap((day) => [
  `${day}/${day}-1.md`,
  `${day}/${day}-2.md`,
  `${day}/${day}-3.md`,
  `${day}/${day}-4.md`,
]);
const spStageFiles = ["SP1/SP1-1.md", "SP1/SP1-2.md", "SP2/SP2-1.md", "SP2/SP2-2.md"];

[
  "Intro.md",
  "D0.md",
  "Epilogue.md",
  "rule.md",
  ...mainDays.map((day) => `${day}/${day}-0.md`),
  ...mainStageFiles,
  "D1/D1-ED.md",
  "D2/D2-ED.md",
  "D3/D3-ED.md",
  "D4/D4-ED.md",
  "SP1/SP1-TR.md",
  "SP1/SP-0.md",
  "SP1/SP1-ED.md",
  "SP2/SP2-TR.md",
  "SP2/SP2-0.md",
  ...spStageFiles,
  "ED/Good Ending.md",
  "ED/True Ending.md",
  "ED/Bad Ending.md",
].forEach(assertFileExists);

[...mainStageFiles, ...spStageFiles].forEach((relativePath) => {
  const raw = readScript(relativePath);
  const routeLabel = path.basename(relativePath, ".md");
  const title = firstH1(raw);
  const stageId = routeLabel.startsWith("D") ? routeLabel.slice(1) : routeLabel;
  const options = parseOptions(raw, stageId);
  const correctOptionId = parseCorrectOption(raw, stageId);
  const responses = parseResponses(raw, stageId);

  assert(Boolean(title), `${relativePath} 必須有第一個 # 大標題供 stage-title 使用`);
  assert(options.length === 4, `${relativePath} 必須有 A/B/C/D 四個選項`);
  assert(options.map((option) => option.id).join(",") === ["A", "B", "C", "D"].map((letter) => `${stageId}-${letter}`).join(","), `${relativePath} 選項 id 必須由檔名推導`);
  assert(options.some((option) => option.id === correctOptionId), `${relativePath} 正確選項必須對應到既有選項`);
  assert(["A", "B", "C", "D"].every((letter) => responses.has(`${stageId}-${letter}`)), `${relativePath} 每個選項都必須有回應劇情`);
});

["D0.md", "Epilogue.md", ...mainDays.map((day) => `${day}/${day}-0.md`), "SP1/SP-0.md", "SP2/SP2-0.md", "SP1/SP1-TR.md", "SP2/SP2-TR.md", "SP1/SP1-ED.md", "ED/Good Ending.md", "ED/True Ending.md", "ED/Bad Ending.md"].forEach((relativePath) => {
  assert(Boolean(firstH1(readScript(relativePath))), `${relativePath} 必須有第一個 # 大標題供 stage-title 使用`);
});

assert(readScript("rule.md").includes("D2 ≥ 100"), "rule.md 必須保留 SP1 的 D2 ≥ 100 條件");
assert(readScript("rule.md").includes("D1 + D2 + D3 + D4 ≥ 200"), "rule.md 必須保留 SP2 的 D1+D2+D3+D4 ≥ 200 條件");
assert(readScript("rule.md").includes("SP1 + SP2 ≥ 75"), "rule.md 必須保留 True Ending 的 SP 分數條件");

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("內容驗證通過：Markdown 劇本檔案、route-label 檔名、stage-title 大標題、選項與回應格式符合目前規格。");

function assertFileExists(relativePath) {
  assert(fs.existsSync(path.join(scriptRoot, relativePath)), `${relativePath} 不存在`);
}

function readScript(relativePath) {
  return fs.readFileSync(path.join(scriptRoot, relativePath), "utf8");
}

function firstH1(raw) {
  return raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
}

function parseOptions(raw, stageId) {
  return raw
    .split("\n")
    .map((line) => line.trim().match(/^-\s*([A-D])｜(.+)$/))
    .filter(Boolean)
    .map((match) => ({ id: `${stageId}-${match[1]}`, text: match[2].trim() }));
}

function parseCorrectOption(raw, stageId) {
  const rawValue = raw.match(/^正確選項：(.+)$/m)?.[1]?.trim() ?? "";
  const letter = rawValue.split("-").at(-1);
  return /^[A-D]$/.test(letter) ? `${stageId}-${letter}` : `${stageId}-A`;
}

function parseResponses(raw, stageId) {
  const responses = new Set();
  for (const line of raw.split("\n")) {
    const match = line.trim().match(/^(?:###\s*)?回應：(.+)$/);
    if (!match) continue;
    match[1].split(/[、,，\s]+/).filter(Boolean).forEach((letter) => {
      responses.add(`${stageId}-${letter.trim()}`);
    });
  }
  return responses;
}

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}
