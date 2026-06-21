# STATUS — news-response

> 單一真相。每次離開前更新（全域憲法收尾鐵律）。
**最後更新：** 2026-06-22
**整體狀態：** 🟢 已上線 Cloudflare：Pages https://news-response.pages.dev + Worker news-response-llm.589411.workers.dev

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

## 下一個具體動作 ⭐（換機器接手看這裡 + docs/devlog/2026-06-22.md）
> 上線 + 存取鎖定 + 3 層備援 + Gemini 主模型 + 草稿/審查分離 皆已完成並 push。Demo 可用。
1. **決定主模型策略**：目前主路 = Gemini 3 Flash Preview（付費、品質佳）；GitHub `gpt-5-chat`（免費）降為備援。
   若要回「免費優先」→ `worker/wrangler.toml` 無關，改 `worker/worker.js` 的 chain 順序把 `github` 排回第一 → `wrangler deploy`。
2. **#2 表單一致性檢查**：勾不相容組合（如 涉及物質=廢水 ＋ 處置=攔油索/回收油料）時，生成前提醒。
3. **glossary.json**（PLAN Phase 3）：術語修正分頁串接。
4. （如需給評審等非 Cloudflare 帳號的人用）把 Access policy 從「Allow owners」改成 email 白名單或 Google。

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
