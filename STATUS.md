# STATUS — news-response

> 單一真相。每次離開前更新（全域憲法收尾鐵律）。
**最後更新：** 2026-07-10
**整體狀態：** 🟢 桃園已上線 Cloudflare + 🟢 多單位導入框架 + 🟡 稿件庫跨裝置同步(前端已建/待接雲) + 🟡 後端搬遷至中油自有 Supabase(schema+資料已搬/待接線)

## 2026-07-10 稿件庫同步 + 後端搬遷中油自有 Supabase ⭐（進行中，換手看這裡）
> 分支 `feat/draft-library`（未 push）。核心任務：①稿件庫可重開/再送LLM優化 ②草稿跨裝置同步。
> 過程中決策擴大為：把 new-cpc/news-response 後端從 launchdock（Joseph 私人）搬到中油自有 Supabase。

**已完成（已驗證）**
- ✅ 前端稿件庫面板：`web/index.html` libCount 徽章→modal，列已存草稿，每筆「↩重開」「♻再送LLM優化」+版本溯源（versionOf）。瀏覽器實測過。
- ✅ 前端 Supabase Auth 同步層：Google/LINE 登入列、`syncPull`合併去重、`cloudPush`存即上雲；**未設定/未登入→只存本機（零回歸）**。已測未設定＋假設定兩態。
- ✅ **DB 搬遷完成**：中油自有專案 **CPCTR's Project**（ref `bqgsgfnxdlmrhmeyxkfq`，org `CPCTR's Org`，AWS 東京 ap-northeast-1）。用 cic 在 SQL Editor 跑完整 migration（scratchpad `cpctr_migrate.sql`）：8 張 `cpc_*` schema+資料列數與 launchdock 全一致 + `news_drafts` 建好。RLS/revoke 安全姿態複製 launchdock migration 001。
  - 註：CPCTR 是**中油自己的 Supabase 帳號**（另一個 Chrome「cpc-58a」登入），MCP 碰不到，只能走 cic 儀表板。

**下一個具體動作（剩餘，標註 owner）**
1. ✅ **抓 CPCTR anon key 完成**（2026-07-10，cic Browser 1＝589411a@gmail.com）：CPCTR 用 Supabase 新版 key 系統，取 **publishable key** `sb_publishable_445I76rNDvF14r68vWpWSA_IjaXM-nV`（可公開＋RLS，等同舊 anon）→ 已填 `web/index.html` 的 `#supabase`（url=`https://bqgsgfnxdlmrhmeyxkfq.supabase.co`）＋ `build_html.py` 重建 `docs/index.html` 驗證帶入 OK。
2. **CPCTR 開 Auth provider**。〔中油/Joseph 填 OAuth secret，我不碰憑證〕
   - ✅ **非機密 URL Configuration 已設**（2026-07-10，cic）：Site URL=`https://response.new-cpc.com`；Redirect URLs=`https://response.new-cpc.com/**`、`https://news-response.pages.dev/**`、`http://localhost:8788/**`。
   - **Google provider**：Callback URL（給 Google Cloud 註冊）=`https://bqgsgfnxdlmrhmeyxkfq.supabase.co/auth/v1/callback`。⚠ 面板現況異常：Client IDs 欄被填成字串「CPCTR's Project」（非法，要真的 `…apps.googleusercontent.com`），且已存了一組 Client Secret（非我設，來源不明）——**Joseph 需用真正的 Google OAuth client id/secret 覆蓋後再開 Enable toggle**。我未改未存。
   - **LINE**（2026-07-10 查證＋建置，複用 92strings `oauth.ts`）：接法 = Supabase **Custom OAuth/OIDC Provider**，**不用 Worker/Edge Function**。前端已就緒（`web/index.html` 已 `loginWith('custom:line')`→`signInWithOAuth({provider:'custom:line'})`，`news_drafts` 已 `auth.uid()` RLS）。
     - ✅ **CPCTR Custom Provider 已建立並啟用**（2026-07-10，cic）：Identifier `line`（前端 `custom:line`）、OIDC Auto-discovery、Issuer `https://access.line.me`、Client ID=**2010578618**（複用舊 LINE Login channel）、Scopes `openid, profile`、Allow users without email ON。Client Secret 由 Joseph 手動貼。
     - ⚠ **待驗**：存檔前讀到 secret 只有 11 字元（LINE Channel Secret 正常 32 hex），可能貼不完整→**以實際 LINE 登入為準**，若 `invalid_client` 就 Update provider 重貼完整 Channel Secret。
     - ⚠ **待做（Joseph，LINE Developers）**：把 callback `https://bqgsgfnxdlmrhmeyxkfq.supabase.co/auth/v1/callback` 加進 channel 2010578618 的 Callback URL 清單（加法、不動原本）。沒加＝LINE 登入會被擋。
     - 坑：①email scope 會炸（LINE email 要另申請，只留 openid/profile）②若日後加 profiles 表且 display_name NOT NULL→比照 92strings migration `20260704120000_handle_new_user_email_optional.sql` 改 trigger COALESCE（news_drafts 現況無此約束，暫踩不到）③別填錯專案（Custom provider 綁專案）。
     - 前置：需一個 LINE Login channel（可考慮複用 new-cpc-worker 的 LIFF channel 2010579062 對應的 Login channel，或新建）。
3. **Worker 重指新專案**：`SUPABASE_URL` + `SUPABASE_SERVICE_KEY` secret 換成 CPCTR。〔Joseph 互動〕
   - 2026-07-10 查證：這支 Worker = 已部署的 **`new-cpc-worker`**（不是 news-response-llm；後者純 LLM proxy 不碰 Supabase）。它用 `env.SUPABASE_URL` + `env.SUPABASE_SERVICE_KEY` 跑整套 pr-approval 簽核（cpc_cases/versions/case_steps/identities/bind_tokens/templates/positions）。
   - ⚠ **帳號**：`new-cpc-worker` **不在** wrangler 現登入的 jjaimark1 帳號（`secret list` 回 Worker not found），屬 **589411 那個 Cloudflare 帳號**。要改 secret 得先 `wrangler login` 切過去（互動，Joseph 跑）或走該帳號 dashboard。
   - 值：`SUPABASE_URL`=`https://bqgsgfnxdlmrhmeyxkfq.supabase.co`；`SUPABASE_SERVICE_KEY`= CPCTR 的 **secret key**（dashboard → Settings → API Keys → Secret keys 的 `sb_secret_…`，或 Legacy service_role JWT）。指令：`echo '<key>' | wrangler secret put SUPABASE_SERVICE_KEY --name new-cpc-worker`。
   - ⚠ **源碼落差**：`new-cpc-worker` 原始碼不在任何 repo（repo 只有 stub README），僅部署版存在。改 secret 不需源碼；但要改邏輯得先找回源碼或從部署版反匯出。
4. 端到端驗證：pr-assistant 簽核 + news-response 草稿同步 都打新專案 OK。〔我+cic〕
5. **最後才做、先問**：launchdock 舊 `cpc_*` 退役刪除（破壞性）。〔待 Joseph 確認〕

> 資料 dump（含 line_uid/姓名，屬個資）只在 scratchpad，**不進 git**。committed 的 002 只有 news_drafts schema。cpc_* 搬遷 schema 待補一份 schema-only migration 進 new-cpc repo。

## 多單位導入框架（2026-06-22 新增，核心進展）⭐
目標：降低「把這套助理複製給桃園以外中油單位」的門檻 → 做成 skill＋單位包。
- ✅ **共用框架 vs 單位專屬層**已拆乾淨。單位專屬層 = `units/<key>/{unit_profile,options,knowledge_base,officials,corrections}.json`。
- ✅ **`web/index.html` 全面可注入**：OPTIONS、KB、officials、corrections、**unit_profile（頁面標題/抬頭/撰稿prompt）** 皆改為注入；無注入則 fallback 桃園（桃園零回歸，已驗證 app 完整 64 functions）。
- ✅ **`build_html.py --unit <key>`**：讀 `units/<key>/` → 輸出 `docs/<key>/index.html`；無參數＝現行桃園行為。
  - 修掉注入 bug：`inject()` 已限定 `count=1`，避免 HTML 註解內出現同名 id 字樣被誤吃掉 app 程式碼。
- ✅ **onboarding skill `skills/news-response-onboard/`**：六階段（訪談採集→**網路新聞採集分析**→生成單位包→建RAG/題庫→建置驗證→打包收尾）。
  - 含「從過去網路新聞分析打造題庫與資料庫」功能（`references/02_web_research.md`）。
- ✅ **共用 rubric 去單位化**：`prompts/audit_rubric.md` 不再寫死桃園煉油廠/桃園環保局。
- ✅ **乾跨驗證＝第三天然氣接收站**（`units/third_lng/`）：真的跑 WebSearch 採集觀塘/藻礁/海象/LNG儲槽/台達二號等實況 → 從零重生 event_types（生態環評/海事船舶/氣體外洩/不實訊息…與煉油廠完全不同）→ build 注入正確 → PII=0。首長姓名一律 ○○○ 不臆測。

> 部署：每單位＝各自安裝包（整 repo + `units/<key>/` + `docs/<key>/`），可用自己的 Claude 訂閱/LLM API 跑 onboarding。
> 待補（下一步）：title/org 執行時覆寫僅以 JS 邏輯模擬驗證、未實際瀏覽器 render；RAG 檢索層(Phase4 cases/)尚未接到新單位。

## 存取鎖定（已完成）
- ✅ **唯一入口**：`https://response.new-cpc.com`（頁面）+ 同源 `/api/generate`（Worker route），**workers.dev 已關閉**（404）。
- ✅ **Cloudflare Access**（policy「Allow owners」= Cloudflare 帳號登入）守著整個 response.new-cpc.com（含 /api）；未登入 curl 一律 302 擋下。
- ✅ 頁面依網域自動選端點：custom domain 走同源 `/api/generate`。
- ✅ **備援鏈（3 層，皆驗證可出稿）**：OpenRouter `google/gemini-3-flash-preview`（主）→ GitHub `gpt-5-chat`（免費備援）→ Anthropic `claude-sonnet-4-6`。
  - 主模型改用 Gemini 3 Flash Preview（品質較佳）；GitHub 免費降為備援。secrets：GITHUB_TOKEN / OPENROUTER_API_KEY / ANTHROPIC_API_KEY 皆在 Cloudflare。
- 成本：主路 Gemini Flash（便宜）按量計；若要回到「免費 GitHub 優先」把 worker.js 的 chain 順序 github 排回第一即可。

## 上線資訊（全部已驗證）
- 頁面（Pages）：https://news-response.pages.dev （任何機器零設定可用）
- 自訂網域：https://response.new-cpc.com （已綁，DNS/SSL 傳播中，稍後生效）
- Worker：https://news-response-llm.589411.workers.dev
  - secrets：GITHUB_TOKEN（主路，免費 gpt-5-chat）、ANTHROPIC_API_KEY（備援 claude-sonnet-4-6）
  - 防護：ALLOWED_ORIGIN 允許 pages.dev + response.new-cpc.com（鎖來源）；APP_KEY 暫關（demo 後再開）
  - ✅ 實證：主路 gpt-5-chat 出稿；GitHub 429 時自動 fallback 到 Anthropic Sonnet 出稿（不斷稿）
- demo 後待辦：`wrangler secret put APP_KEY` + 頁面填同一把 App Key 開啟密鑰保護。

## 一句話現況
桃園煉油廠「新聞說明稿快速編輯程式」：結構化表單勾關鍵字 → Worker 代理 LLM（gpt-5-chat 免費）生稿 → 具名確認 → 乾淨對外稿 + 內部審查註記 → 人工核稿 → 回填學習。本機 demo 跑通。

## 下一個具體動作 ⭐（換機器接手看這裡）
> 多單位骨架 + onboarding skill + 第三接收站乾跨 皆完成並 push。
1. **實際瀏覽器驗證 third_lng**：開 `docs/third_lng/index.html`，確認標題/抬頭執行時顯示「第三天然氣接收站」、勾選框長出 LNG 詞彙、跑一題生稿。
3. **用 skill 正式導入第一個真實單位**：拿到該單位身分/設備/速報後跑 `skills/news-response-onboard` 六階段。
4. **接 RAG 檢索層到新單位**（Phase4）：`extract_case_card.py` → `units/<key>/cases/`，生成時檢索。
5. （原桃園待辦保留）#2 表單一致性檢查、glossary.json 術語分頁、主模型策略（Gemini 主／GitHub 免費備援切換在 `worker/worker.js` chain 順序）。

## 新機器接手 SOP
```
git pull
cd worker && wrangler login        # Cloudflare 帳號 589411@gmail.com（OAuth 每台要重登）
```
- 線上服務（Pages + Worker + 3 secrets）都在 Cloudflare，換機器不受影響。
- 本機 `wrangler dev` 才需重建 `worker/.dev.vars`（gitignored；GITHUB_TOKEN + ALLOWED_ORIGIN=localhost:8788）。
- 改 worker → `cd worker && wrangler deploy`；改頁面 → `python3 scripts/build_html.py && wrangler pages deploy docs --project-name=news-response --branch=main --commit-dirty=true`。
3. **上線部署**（防護已做完 e40ed93，待 Joseph 確認後執行）：
   a. `cd worker && wrangler login`（互動，Joseph 自己跑）。
   b. 設正式網域：改 `wrangler.toml` 的 `ALLOWED_ORIGIN` 為正式頁面網域。
   c. `wrangler deploy`；`wrangler secret put GITHUB_TOKEN`、`wrangler secret put APP_KEY`（選用 ANTHROPIC_API_KEY 當 fallback，避免免費額度 429）。
   d. 前端「⚙ API 設定」填正式 Worker URL + 同一把 App Key。
   e. 頁面 `docs/index.html` 放**內網**（PLAN 決策，勿用公開 GitHub Pages）。
4. 術語修正分頁接 `glossary.json`（PLAN Phase 3）。

> 注意：GitHub Models 免費版有速率限制（今日測試已撞 429）。正式環境建議設 ANTHROPIC_API_KEY 當 fallback。

## 本機開發環境（重啟後要重跑）
- 靜態站（no-cache）：`python3 <scratchpad>/nocache_server.py` 服務 docs/ 於 8788（或 `python3 -m http.server 8788 -d docs`）。
- Worker：`cd worker && npx wrangler dev --port 8787 --local`（讀 `worker/.dev.vars` 的 GITHUB_TOKEN + ALLOWED_ORIGIN=localhost:8788 解 CORS）。
- 前端「⚙ API 設定」→ Worker 代理，Endpoint = `http://localhost:8787`。
- ⚠ token 在 `worker/.dev.vars`（gitignored）。提醒：那把 PAT 曾貼在終端機，建議測試告一段落後 revoke 重發。

## 已完成（皆已 push）
- ✅ 去識別化 + squash 乾淨歷史（6576a85）：正文 38 檔去名、3 檔改名、40+ 人名與員工 email 清除，全歷史殘留人名=0；單位名稱保留。工具 `scripts/deidentify.py` + gitignored 對照表 `scripts/name_map.local.json`。
- ✅ 長官具名 + 語音預校正 + gpt-5-chat + 乾淨出稿格式（00e8d9c）：
  - `officials.json` + 具名確認面板（複數副總/副執行長、立委/市議員；逾180天標⚠；○○○不具名）。
  - `corrections.json` + 語音輸入(Web Speech API) + 生成前自動預校正。
  - Worker `GH_MODEL=gpt-5-chat`，自動挑 max_tokens/max_completion_tokens。
  - 出稿本文乾淨無標記，溯源改列「內部審查註記」；複製/LINE/學習只取對外本文。
  - 治理：CONSTITUTION 條目六 + CLAUDE.md 改人名兩類分流（公開首長可具名／員工民眾去名）。

## 治理重點
- 人名兩類：現任公開職務首長/民代可具名（officials.json，須正確不臆測）；員工/民眾/傷亡者一律去名。
- `reference_md_deidentified/`（RAG 素材）維持全去名；`doc/` 原始檔永不進 git。
- 金鑰與含人名的對照表一律 gitignored，不入庫/歷史。

## 進度脈絡（新的在上）
- 2026-06-21 去識別化收尾 + 長官具名/語音校正/gpt-5-chat/乾淨格式；建 private repo 並 push。
- 2026-06-19 起草 STATUS。
- 2026-06-14 init：憲法/框架/知識庫/題庫/去識別化素材庫。

## 已知坑
- 去識別化素材涉及機敏資料，任何新增素材 commit 前必跑 `scripts/deidentify.py` 並確認殘留=0。
- gpt-5/gpt-5-mini 等推理模型需足夠 token 預算才會出文（worker 已自動改用 max_completion_tokens）。
