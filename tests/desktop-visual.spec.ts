import { expect, test } from "@playwright/test";

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
});
