# 永續心動研究社

三日制永續選擇 AVG。專案以「ESG 消費行為改變」為主題，透過戀愛養成遊戲的選項流程，讓玩家在源頭減量、寶特瓶回收與複合包材分類等情境中累積環保積分。

## 技術架構

- Astro SSG 靜態網站
- TypeScript、HTML、CSS
- pnpm 套件管理
- i18n JSON 劇情資料，目前實作 `zh-TW`
- Motion One 立繪互動動畫
- GSAP 對話框打字機效果
- Firebase Firestore 排行榜
- Firebase App Check 搭配 reCAPTCHA v3
- `bad-words` 暱稱過濾

## 遊戲內容

- 主線共 3 天，每天 4 個關卡。
- 每關 4 個選項，最佳永續行為得 25 分，總分上限 300 分。
- 環保積分同時作為好感度，用於顯示綠葉轉愛心的像素進度條。
- 遊戲狀態儲存在瀏覽器 `localStorage`，並加入 Base64 與時間戳混淆。
- 達成指定分數條件後，可解鎖隱藏支線訊息。
- 完成後可送出玩家暱稱與總分到 Firestore 排行榜。

## 專案結構

```text
.
├── public/assets/characters/      # 角色 SVG 立繪
├── scripts/                       # 內容與流程驗證腳本
├── src/components/                # AVG 介面元件
├── src/data/i18n/zh-TW/game.json  # 遊戲劇情、選項、配分與支線條件
├── src/lib/game/                  # 遊戲型別、流程引擎與儲存邏輯
├── src/lib/leaderboard/           # Firebase 排行榜服務
├── src/lib/security/              # 暱稱過濾
├── src/pages/index.astro          # 主要頁面入口
├── src/scripts/game.ts            # 客戶端遊戲互動
├── src/styles/global.css          # 全域像素風 UI
├── astro.config.mjs               # Astro 靜態輸出設定
├── firebase.json                  # Firebase 設定
└── firestore.rules                # Firestore 安全規則
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
- `pnpm run verify:content`：驗證三日主線、關卡、選項、配分與隱藏支線資料。
- `pnpm run verify:flow`：驗證 Day 1 到 Day 3 的流程推進、配分與支線解鎖條件。
- `pnpm run build`：先執行 Astro check，再產生 `dist/` 靜態輸出。
- `pnpm preview`：預覽已建置的靜態成果。

## 環境變數

複製 `.env.example` 為 `.env`，並填入 Firebase 與 reCAPTCHA v3 公開設定。

```bash
PUBLIC_FIREBASE_API_KEY=
PUBLIC_FIREBASE_AUTH_DOMAIN=
PUBLIC_FIREBASE_PROJECT_ID=
PUBLIC_FIREBASE_APP_ID=
PUBLIC_RECAPTCHA_V3_SITE_KEY=
```

若未設定 Firebase 相關環境變數，遊戲仍可在本機執行，但排行榜會停用。

Astro 部署到 GitHub Pages 時，可依實際網址設定：

```bash
PUBLIC_SITE_URL=https://<github-user>.github.io
PUBLIC_BASE_PATH=/Hackathon/
```

若部署在網域根目錄，`PUBLIC_BASE_PATH` 可維持預設 `/`。

## Firebase 設定

Firestore 使用 `leaderboard` collection 儲存排行榜資料。`firestore.rules` 目前允許公開讀取、只允許新增資料，並限制：

- `playerName` 必須是 1 到 16 字元的字串。
- `score` 必須是 0 到 300 的整數。
- `createdAt` 必須等於伺服器請求時間。
- 禁止更新與刪除排行榜資料。

正式啟用排行榜前，請在 Firebase Console 啟用 Firestore、設定 App Check，並將 reCAPTCHA v3 site key 填入 `.env`。

## 修改劇情內容

主要劇情集中在 `src/data/i18n/zh-TW/game.json`。新增或調整內容後，建議至少執行：

```bash
pnpm run verify:content
pnpm run verify:flow
pnpm run check
```

遊戲邏輯位於 `src/lib/game/` 與 `src/scripts/game.ts`，請避免在 Astro 元件內硬編碼劇情文字，維持內容與邏輯分離。

## 部署

專案採 Astro 靜態輸出，`pnpm run build` 會產生 `dist/`。部署到 GitHub Pages 前，請先確認 `PUBLIC_SITE_URL` 與 `PUBLIC_BASE_PATH` 是否符合實際 repository page 路徑。
