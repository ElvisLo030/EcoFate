import { expect, test, type Page } from "@playwright/test";

async function installD1FirstStageSave(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const now = Date.now();
    const state = {
      playerName: "111",
      currentDayIndex: 0,
      currentStageIndex: 0,
      dayScores: { day1: 0, day2: 0, day3: 0, day4: 0, day5: 0 },
      spScores: { sp1: 0, sp2: 0 },
      totalScore: 0,
      answeredStageIds: [],
      selectedAnswers: {},
      pendingSpRouteId: null,
      currentSpRouteId: null,
      currentSpStageIndex: 0,
      completedIntros: ["day1"],
      completedOutros: [],
      completedSpRouteIntros: [],
      completedSpRoutes: [],
      toBeContinued: false,
      completed: false,
      completedEnding: false,
      completedEpilogue: false,
      startedAt: now,
      completedAt: null,
      savedAt: now
    };
    const spScore = Object.values(state.spScores).join(",");
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
    const checksum = btoa(encodeURIComponent(source)).slice(0, 24);
    localStorage.setItem("hackathon-esg-avg-save-v2", btoa(encodeURIComponent(JSON.stringify({ state, checksum }))));
  });
}

async function revealChoices(page: Page): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await page.locator("#dialog-text.is-finished").waitFor({ timeout: 10000 });
    if (await page.locator(".choice-button").count() >= 4) return;
    await page.locator("#dialog-box").click({ force: true });
  }
}

async function revealChoicesWithEnter(page: Page): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await page.locator("#dialog-text.is-finished").waitFor({ timeout: 10000 });
    if (await page.locator(".choice-button").count() >= 4) return;
    await page.keyboard.press("Enter");
  }
}

test.describe("桌機版遊戲介面", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("hackathon-esg-avg-save-v2");
      localStorage.removeItem("hackathon-esg-avg-save");
      sessionStorage.setItem("welcome-seen", "1");
    });
  });

  test("桌機 viewport 使用雙欄遊戲介面且不顯示手機限制遮罩", async ({ page }) => {
    await page.goto("/game/");

    const gameWindow = page.locator(".game-window");
    const scenePanel = page.locator(".scene-panel");
    const dialogBox = page.locator("#dialog-box");
    const desktopOverlay = page.locator(".desktop-overlay");
    const landscapeOverlay = page.locator(".landscape-overlay");
    const welcomeOverlay = page.locator("#welcome-overlay");

    await expect(gameWindow).toBeVisible();
    await expect(scenePanel).toBeVisible();
    await expect(dialogBox).toBeVisible();
    await expect(welcomeOverlay).toBeHidden();
    await expect(desktopOverlay).toBeHidden();
    await expect(landscapeOverlay).toBeHidden();
    await expect(page.locator("#dialog-text")).toHaveClass(/is-finished/);

    const layout = await page.evaluate(() => {
      const scene = document.querySelector(".scene-panel")!.getBoundingClientRect();
      const dialog = document.querySelector("#dialog-box")!.getBoundingClientRect();
      const game = document.querySelector(".game-window")!.getBoundingClientRect();
      const mainGridStyle = getComputedStyle(document.querySelector(".main-grid")!);
      const desktopOverlayStyle = getComputedStyle(document.querySelector(".desktop-overlay")!);
      const landscapeOverlayStyle = getComputedStyle(document.querySelector(".landscape-overlay")!);

      return {
        gameWidth: game.width,
        sceneWidth: scene.width,
        dialogWidth: dialog.width,
        sceneRight: scene.right,
        dialogLeft: dialog.left,
        dialogTop: dialog.top,
        sceneTop: scene.top,
        gridColumns: mainGridStyle.gridTemplateColumns,
        desktopOverlayDisplay: desktopOverlayStyle.display,
        landscapeOverlayDisplay: landscapeOverlayStyle.display,
      };
    });

    expect(layout.gameWidth).toBeGreaterThan(900);
    expect(layout.sceneWidth).toBeGreaterThan(layout.dialogWidth);
    expect(layout.dialogLeft).toBeGreaterThanOrEqual(layout.sceneRight - 2);
    expect(Math.abs(layout.dialogTop - layout.sceneTop)).toBeLessThanOrEqual(2);
    expect(layout.gridColumns.split(" ").length).toBeGreaterThanOrEqual(2);
    expect(layout.desktopOverlayDisplay).toBe("none");
    expect(layout.landscapeOverlayDisplay).toBe("none");

    await expect(gameWindow).toHaveScreenshot("desktop-game-initial.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    });
  });

  test("矮桌機 viewport 的四個選項維持在可捲動且可點擊區域內", async ({ page }) => {
    await page.setViewportSize({ width: 1240, height: 614 });
    await installD1FirstStageSave(page);
    await page.goto("/game/");
    await revealChoices(page);

    const layout = await page.evaluate(() => {
      const main = document.querySelector(".main-grid")!.getBoundingClientRect();
      const side = document.querySelector("#side-panel")!.getBoundingClientRect();
      const choiceArea = document.querySelector("#choice-area") as HTMLElement;
      const lastChoice = document.querySelector(".choice-button:last-child")!.getBoundingClientRect();

      return {
        mainBottom: main.bottom,
        sideBottom: side.bottom,
        choiceClientHeight: choiceArea.clientHeight,
        choiceScrollHeight: choiceArea.scrollHeight,
        lastChoiceBottom: lastChoice.bottom
      };
    });

    expect(layout.sideBottom).toBeLessThanOrEqual(layout.mainBottom + 1);
    expect(layout.choiceScrollHeight).toBeGreaterThan(layout.choiceClientHeight);

    const lastChoice = page.locator(".choice-button").last();
    await lastChoice.scrollIntoViewIfNeeded();
    await expect(lastChoice).toBeInViewport();
    await lastChoice.click();
    await expect(lastChoice).toHaveClass(/is-pending/);
  });

  test("桌機 Enter 鍵可以推進對話並確認已選選項", async ({ page }) => {
    await installD1FirstStageSave(page);
    await page.goto("/game/");
    await revealChoicesWithEnter(page);

    await expect(page.locator(".choice-button")).toHaveCount(4);

    const firstChoice = page.locator(".choice-button").first();
    await firstChoice.click();
    await expect(firstChoice).toHaveClass(/is-pending/);

    await page.keyboard.press("Enter");
    await expect(page.locator(".choice-button").first()).toBeDisabled();
    await expect(page.locator("#next-stage-button")).toBeDisabled();
    await expect(page.locator("#dialog-text")).not.toHaveText("你今天有帶水壺嗎？");
  });
});
