# 永續回收命運機

> 一款以「ESG 消費行為改變」為主題的網頁戀愛養成遊戲（AVG），透過選項流程讓玩家在源頭減量、寶特瓶回收等真實情境中累積環保積分。

**線上試玩：** https://game.elvislo.tw

## 遊戲內容

- **主線 5 天**，每天 4 個關卡，主題涵蓋源頭減量、寶特瓶回收、複合材質、金屬回收、電子發票。
- 每關 4 個選項，最佳永續行為得 25 分，主線滿分 500 分。
- **SP 隱藏路線**：D2 達滿分觸發 SP1（艾薇路線），D1～D4 合計 ≥ 200 分觸發 SP2（紙乃路線）。
- **三種結局**：主線 ≥ 450 且 SP 合計 ≥ 75 → True Ending；主線 ≥ 400 → Good Ending；其他 → Bad Ending。
- 環保積分（好感度）同步顯示為「綠葉轉愛心」像素進度條。
- 遊戲狀態儲存於瀏覽器 `localStorage`，含 Base64 + 時間戳混淆校驗，防止一般玩家竄改。

## 技術架構

| 類別 | 技術 |
|------|------|
| 框架 | [Astro](https://astro.build) SSG 靜態輸出 |
| 語言 | TypeScript、HTML、CSS |
| 套件管理 | pnpm |
| 劇本格式 | Markdown（`src/data/i18n/zh-TW/script/**/*.md`） |
| UI 文字 | YAML（`src/data/i18n/zh-TW/ui.yaml`） |
| 動畫 | Motion One（立繪互動）、GSAP（對話打字機效果） |
| 部署 | GitHub Pages + GitHub Actions |

## 專案結構

```text
.
├── .github/workflows/deploy.yml       # GitHub Actions 自動部署
├── public/
│   ├── CNAME                          # 自訂網域（部署時請修改）
│   └── assets/
│       ├── characters/                # 角色 SVG 立繪
│       └── icons/                     # 像素風 UI 圖示
├── scripts/
│   ├── verify-content.mjs             # 劇本結構驗證
│   └── verify-flow.mjs                # 遊戲流程與積分驗證
├── src/
│   ├── components/                    # AVG UI 元件（對話框、選項、進度條等）
│   ├── data/i18n/zh-TW/
│   │   ├── script/                    # 劇本 Markdown 檔案
│   │   │   ├── D0.md                  # 序章
│   │   │   ├── D1/ ~ D5/              # 主線 Day 1 ~ Day 5（含開場、關卡、結尾）
│   │   │   ├── SP1/ SP2/             # 隱藏路線
│   │   │   ├── ED/                    # 三種結局
│   │   │   ├── Intro.md               # 歡迎彈窗
│   │   │   └── Epilogue.md            # 結語
│   │   └── ui.yaml                    # UI 文字（按鈕、提示等）
│   ├── lib/game/
│   │   ├── engine.ts                  # 遊戲流程引擎
│   │   ├── scriptLoader.ts            # 建置期 MD 解析器
│   │   ├── storage.ts                 # localStorage 存讀取與校驗
│   │   └── types.ts                   # 型別定義
│   ├── lib/security/
│   │   └── profanity.ts               # 暱稱不雅字眼過濾
│   ├── pages/
│   │   ├── index.astro                # 主畫面
│   │   └── game.astro                 # 遊戲頁面
│   ├── scripts/
│   │   ├── home.ts                    # 主畫面互動邏輯
│   │   └── game.ts                    # 遊戲客戶端邏輯
│   └── styles/                        # 全域像素風 CSS
└── astro.config.mjs
```

## 開發環境

需要 Node.js 22 與 pnpm（`packageManager` 指定為 `pnpm@10.0.0`）。

```bash
# 安裝相依套件
pnpm install

# 啟動開發伺服器
pnpm dev
```

開發伺服器啟動後，依終端機顯示的本機網址開啟遊戲。

### 環境變數

複製 `.env.example` 為 `.env.local` 並填入設定：

```bash
cp .env.example .env.local
```

| 變數名稱 | 說明 | 是否必填 |
|----------|------|----------|
| `PUBLIC_GA_ID` | Google Analytics Measurement ID | 選填（留空不載入 GA） |

## 常用指令

```bash
pnpm run check           # Astro 型別與診斷檢查
pnpm run verify:content  # 驗證劇本結構、選項與配分
pnpm run verify:flow     # 驗證 Day 流程推進與結局判定
pnpm run build           # 建置靜態輸出（先執行 check）
pnpm preview             # 預覽建置成果
```

## 修改劇本內容

劇本以 Markdown 格式存放於 `src/data/i18n/zh-TW/script/`。

**關卡 MD 格式範例（D1-1.md）：**

```markdown
# 關卡標題

主角：小澄
正確選項：1-1-B

### 引導對話
小澄｜你今天帶了幾個購物袋呢？

### 選項
- A｜忘記帶，用店家塑膠袋
- B｜帶了自己的環保袋
- C｜用紙袋代替
- D｜買了一個新塑膠袋

### 回應：B
小澄｜哇，你真的很有環保意識！

### 回應：A、C、D
小澄｜下次記得帶環保袋喔！

### 知識點
每人每年減少使用 100 個塑膠袋，可減少約 0.5 kg 的碳排放。
```

新增或調整劇本後，建議執行：

```bash
pnpm run verify:content
pnpm run verify:flow
pnpm run check
```

詳細格式規則請參閱 `src/data/i18n/zh-TW/script/rule.md`。

## 自行部署

此專案採 GitHub Pages 靜態部署。

1. Fork 此專案。
2. 修改 `public/CNAME` 為你的網域（或刪除此檔案以使用 GitHub Pages 預設網址）。
3. 至 GitHub repo 的 **Settings → Pages**，將 Source 設為 **GitHub Actions**。
4. 若需要 Google Analytics，在 repo 的 **Settings → Secrets and variables → Actions → Variables** 新增 `PUBLIC_GA_ID`，填入你的 Measurement ID。
5. Push 至 `main` 分支即自動觸發部署。

## 授權

本專案採用自訂[非商業開源授權（Non-Commercial Open Source License）](LICENSE)。

- 允許個人、教育、非營利目的的使用、修改與散布。
- **禁止任何商業用途**（含販賣、付費服務整合、廣告營利等）。
- 散布時須保留原始版權聲明與本授權條款。
- 商業授權洽詢：help@elvislo.tw

---

*2026 技職盃黑客松初賽 N08 組參賽作品*
