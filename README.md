# 永續心動研究社

兩日制永續選擇 AVG。專案以「ESG 消費行為改變」為主題，透過戀愛養成遊戲的選項流程，讓玩家在源頭減量、寶特瓶回收等情境中累積環保積分。

## 技術架構

- Astro SSG 靜態網站
- TypeScript、HTML、CSS
- pnpm 套件管理
- i18n JSON 劇情資料，目前實作 `zh-TW`
- Motion One 立繪互動動畫
- GSAP 對話框打字機效果
- `bad-words` 暱稱過濾

## 遊戲內容

- 主線共 2 天，每天 4 個關卡。
- 每關 4 個選項，最佳永續行為得 25 分，總分上限 200 分。
- 環保積分同時作為好感度，用於顯示綠葉轉愛心的像素進度條。
- 遊戲狀態儲存在瀏覽器 `localStorage`，並加入 Base64 與時間戳混淆。
- D1+D2 達 150 分以上進入 Good Ending，否則進入 Bad Ending。
- 完成後會顯示結算報告，玩家可回到主畫面重新開始或選擇章節。

## 專案結構

```text
.
├── public/assets/characters/      # 角色 SVG 立繪
├── scripts/                       # 內容與流程驗證腳本
├── src/components/                # AVG 介面元件
├── src/data/i18n/zh-TW/game.json  # 遊戲劇情、選項、配分與支線條件
├── src/lib/game/                  # 遊戲型別、流程引擎與儲存邏輯
├── src/lib/security/              # 暱稱過濾
├── src/pages/index.astro          # 主要頁面入口
├── src/scripts/game.ts            # 客戶端遊戲互動
├── src/styles/global.css          # 全域像素風 UI
└── astro.config.mjs               # Astro 靜態輸出設定
```

## 開發環境

需要 Node.js 與 pnpm。此專案的 `packageManager` 指定為 `pnpm@10.0.0`。

```bash
pnpm install
pnpm dev
```

開發伺服器啟動後，依終端機顯示的本機網址開啟遊戲。

## 常用指令

```bash
pnpm run check
pnpm run verify:content
pnpm run verify:flow
pnpm run build
pnpm preview
```

- `pnpm run check`：執行 Astro 型別與診斷檢查。
- `pnpm run verify:content`：驗證兩日主線、關卡、選項、配分與 GE/BE 規則資料。
- `pnpm run verify:flow`：驗證 Day 1 到 Day 2 的流程推進、配分與 GE/BE 判定。
- `pnpm run build`：先執行 Astro check，再產生 `dist/` 靜態輸出。
- `pnpm preview`：預覽已建置的靜態成果。

## 修改劇情內容

主要劇情集中在 `src/data/i18n/zh-TW/game.json`。新增或調整內容後，建議至少執行：

```bash
pnpm run verify:content
pnpm run verify:flow
pnpm run check
```

遊戲邏輯位於 `src/lib/game/` 與 `src/scripts/game.ts`，請避免在 Astro 元件內硬編碼劇情文字，維持內容與邏輯分離。

## 部署

專案採 Astro 靜態輸出，`pnpm run build` 會產生 `dist/`。目前不需要額外環境變數。
