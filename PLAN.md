# 開發計畫 — 交接給 Claude Code 執行

> 目標：把本 repo 收斂成**單一正式版**的「新聞說明稿快速編輯程式」，
> 含結構化勾選表單、零（或單一伺服器）金鑰的 LLM 後端、PR 式自動學習。
> 執行守則見 `CLAUDE.md`；內容紅線見 `CONSTITUTION.md`。**只開 PR，不直接 push master。**

## 決策定案（不要再改動方向）
- **單一正本**：UI = `web/index.html` →（`build_html.py`）→ `docs/index.html`；RAG = `knowledge_base.json`；後端 = Worker → GitHub Models（免費）→ Anthropic 備援。
- **Groq 版退役**：移除任何 `rag_context.json` / `server.py` / Groq 相關殘留，全部對齊本 repo。
- **金鑰策略**：
  - Actions（`learn-from-pr`、`generate-draft`）→ 內建 `GITHUB_TOKEN` + `permissions: models:read`，**零 API key**。
  - `@claude` 代理 → 用 **`CLAUDE_CODE_OAUTH_TOKEN`**（`claude setup-token`，走 Pro/Max 訂閱），非 API key。
  - 網頁即時生成 → Worker 內放**一把** GitHub PAT（`models:read`）；瀏覽器零金鑰。
- **部署安全**：repo 設 **private**；**正式服務部署到內網**，不用公開的 GitHub Pages（個人私有 repo 的 Pages 網站仍是公開）。

---

## Phase 0 — 安全與初始化（先做）
- [ ] 建 **private** repo，push 現狀；確認 `.gitignore` 已擋 `doc/`、`*.docx/pdf/xlsx`。
- [ ] 抽查 `reference_md_deidentified/` 無殘留個資（手機/員編/姓名）。
- [ ] 設 secrets：`CLAUDE_CODE_OAUTH_TOKEN`（@claude 用）。Worker 的 token 用 `wrangler secret put`，不進 repo。
- [ ] **不要**啟用 GitHub Pages 對外；預覽一律本機開 `docs/index.html`。
- 驗收：repo 私有、無敏感檔入庫、`@claude` 能在 Issue 回應。

## Phase 1 — 收斂為單一版本
- [ ] 全 repo 搜尋並移除 Groq / `rag_context.json` / `server.py` 殘留；統一改用 `knowledge_base.json`。
- [ ] 確認 `web/index.html` 的 `OPTIONS` 物件為唯一的關鍵字來源（勾選框由它驅動）。
- [ ] `python scripts/build_html.py` 能成功產 `docs/index.html`。
- 驗收：repo 內只有一套 UI、一套 RAG 檔；build 通過。

## Phase 2 — 後端與金鑰
- [ ] `worker/`：部署 `wrangler deploy`；設 `GITHUB_TOKEN`（models:read）、選用 `ANTHROPIC_API_KEY`。
- [ ] Worker 加 **共享密鑰標頭**驗證（前端帶 `x-app-key`，Worker 比對 env `APP_KEY`），並鎖死 `ALLOWED_ORIGIN`，避免端點被白嫖。
- [ ] 前端「API 設定」改為填 Worker URL + App Key（不再出現任何 LLM 金鑰欄位於正式模式）。
- 驗收：從內網頁面按「生成初稿」可即時出稿；瀏覽器 Network 內看不到任何 LLM 金鑰。

## Phase 3 — 表單與術語（多數已完成，需驗收/補強）
- [ ] 對照使用說明書 P3–18，逐欄位核對：通報來源、地點設備、涉及物質、原因、目前情況、處置方式、高風險（必填、缺漏擋下）、補充說明。
- [ ] 「正式版」需套官方抬頭＋三段式＋頁尾發言人區塊（姓名 ○○○）。
- [ ] 完成「術語修正」分頁：建一份 `glossary.json`（瓦斯→液化石油氣 等），LLM 修正時注入。
- 驗收：三種輸出（初稿/正式版/術語修正）皆正確，PII 偵測會擋。

## Phase 4 — RAG 學習迴圈（護城河）
- [ ] 用 `scripts/extract_case_card.py` 批次跑 `reference_md_deidentified/`（約 189 篇），產出 `cases/*.json` 初始底庫。
- [ ] 生成時做輕量檢索：依勾選的 event 標籤從 `cases/` 撈 2–3 筆最相似，注入 prompt（**不做向量 embedding**，依 FRAMEWORK 附錄A）。
- [ ] `learn-from-pr.yml`：新素材合入 → 自動抽案例卡 → 開 PR 給你審。
- 驗收：新增一篇素材後，下一次相似事件能引用到剛學到的內容。

## Phase 5 — 交付與維運
- [ ] `@claude` 新增關鍵字流程實測（改 `OPTIONS` + 知識庫 + 重建 docs + 開 PR）。
- [ ] 複製 / 分享 LINE / （選用）PWA 離線。
- [ ] 將 `docs/index.html` 部署到內網；更新 `STATUS.md`、`DEPLOY.md`。
- 驗收：內網可用、可一鍵複製/分享、文件齊備。

---

## 給執行代理的提醒
- 任何「對外稿」內容不得含個資；人名一律職稱或 ○○○。
- 改完 UI 一定 `python scripts/build_html.py` 重建 `docs/`。
- 每個 Phase 各開一個 PR，PR 說明列出：動了哪些檔、是否重建 docs、個資風險。
