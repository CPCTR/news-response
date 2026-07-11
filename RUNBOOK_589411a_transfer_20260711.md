# Runbook：移交 infra 至 589411a（定稿）

日期：2026-07-11
產出者：Fable（總指揮）
執行者：Claude Code（CC）＋ Joseph（互動登入與拍板點）
依據：`HANDOFF_fable_migration_20260711.md`（CC 對帳，全部採信）
決策已拍板（Joseph, 2026-07-11）：①先驗 #1/#2 再移交 ②舊表立即改名封存、真刪等移交後穩定一週 ③repo 採 589411a 鏡像、589411 留原本、單向推。

**帳號紀律**：本 runbook 只涉及 `589411`（來源＋執行 token）與 `589411a`（目的地）。`jjaimark1` 與本案無關，任何步驟出現它即停下回報。

---

## Phase 0：驗收前置（Joseph，分鐘級，先做）

- [x] **P0-1** Google 真人登入實測通過（Joseph 回報，2026-07-11）→ Phase 2 放行條件成立。
- [ ] **P0-2** Cloudflare Access 員工白名單：**等待中**——Joseph 已聯繫，待對方提供 Gmail 名單（2026-07-11）。不擋 Phase 2A/2B，僅擋正式對外開放。

## Phase 1：舊表封存（CC 或 Fable via MCP，隨時可做，非破壞）

- [x] **P1-1** launchdock（ref `lxudxtpfenotkpgmhomq`）8 張 `cpc_*` 改名為 `cpc_old_*` 完成（2026-07-11 18:01 CST，execute_sql 單一 transaction，無錯誤）。⚠ **`news_drafts` 不適用**：launchdock 無此表（稿件庫直接建在 CPCTR），故只改 8 張。驗證：`pg_tables` 查 `cpc_%` → 8 張全為 `cpc_old_*`、無殘留 `cpc_*`。
- [x] **P1-2** 驗證通過（2026-07-11 18:01 CST）：curl `https://new-cpc-worker.589411.workers.dev/approval/templates` 與 `/approval/board` 皆 **HTTP 200** 且回得出 CPCTR 的 templates／cases → worker 讀 CPCTR、對 launchdock 改名零影響。
- [x] **P1-3** 已記錄改名清單與時間於 `STATUS.md`（2026-07-11 段）。**真刪排程：Phase 2 完成＋正式站穩定運轉 7 天後，經 Joseph 明確授權才執行 DROP。**

## Phase 2：移交 589411a（主體，三段，每段驗證完才進下一段）

### 2A. Repo 段（先於一切 Cloudflare 操作）

- [x] **2A-1** 空 repo 由 Joseph 手動建於 GitHub **個人帳號 `CPCTR`**（非 org）：`https://github.com/CPCTR/news-response`、`https://github.com/CPCTR/new-cpc`（private）。⚠ 帳號地圖更新：589411a 的 GitHub 身份＝個人帳號 `CPCTR`。
- [x] **2A-2** 完成（2026-07-11）：本機加 remote `cpctr`，`git push cpctr --all && --tags` 推兩 repo。**改用 `--all`＋`--tags` 而非 `--mirror`**（--mirror 會連 refs/remotes 追蹤 ref 一起推、弄髒目標）。方向鎖死 589411→CPCTR 單向。⚠ 認證坑：一開始 403「denied to 589411」——CC 憑證是 GitHub 使用者 `589411`，需 Joseph 在 `CPCTR` 個人帳號把 `589411` 加為兩 repo 的 collaborator(=Write)且 `589411` 接受邀請後才可推（個人帳號 repo 的 collaborator 一律 Write，無角色下拉）。
- [x] **2A-3** HEAD 驗證通過（2026-07-11）：`new-cpc` main `15cf6f9b`＝遠端；`news-response` `feat/draft-library` `5958752`＋`master` `cfdad57` 皆＝遠端。

### 2B. Cloudflare 段

- [x] **2B-1** 改走 **API Token**（非 OAuth——Safari 預設登 589411、consent 會授權錯帳號）。589411a Cloudflare account id `ca3e37fa2f5e10d85031d34cb3b988fd`。token 存 Keychain `cf-589411a-token`。⚠ 坑：只設 token、沒設 `CLOUDFLARE_ACCOUNT_ID` 時 wrangler 會掉回舊帳號→10000；**每個指令都要 export `CLOUDFLARE_API_TOKEN`＋`CLOUDFLARE_ACCOUNT_ID=ca3e37fa…`**。token 權限：Account 範圍的 Account Settings:Read / Workers Scripts / Workers KV Storage / Cloudflare Pages / Workers AI（Edit）。
- [x] **2B-2** 589411a KV `TIERS` 建好 id `267d75996ffe4577a1839364dd6f2186`（`new-cpc/worker/wrangler.toml` 已更新、註解保留舊 589411 id）。另註冊 workers.dev 子網域 **`cpctr`**（API PUT）。
- [x] **2B-3** 兩支 worker 部署到 589411a：`new-cpc-worker.cpctr.workers.dev`(c8b81c9a)、`news-response-llm.cpctr.workers.dev`(635737da)。⚠ `news-response-llm` 的 route（zone new-cpc.com 在 589411、跨帳號）已註解、改開 `workers_dev=true` 用原生網址驗證（跨帳號路由留 2C）。
- [x] **2B-4** Secrets 經 Keychain（`cf-589411a-*`，值不進對話）灌入：`new-cpc-worker`=SUPABASE_SERVICE_KEY/LINE_CHANNEL_TOKEN/LINE_CHANNEL_SECRET/ANTHROPIC_API_KEY/OPENROUTER_API_KEY；`news-response-llm`=GITHUB_TOKEN/OPENROUTER_API_KEY/ANTHROPIC_API_KEY。`secret list` 驗證名單到齊。
- [x] **2B-5（MVP）** Pages 上 589411a：①`news-response` docs → `news-response-cy7.pages.dev`（生稿頁,200）；②`new-cpc` hub（Astro build dist）→ `new-cpc.pages.dev`（200）。⏸ **戰情表 `apps/pr-approval` 延後**：源碼不在 repo，簽核先走 LINE bot 頂著，併入「稿件收斂」支線一起重建。（`news-response` 子網域被占→自動 `-cy7` 尾綴，2C 用自訂網域指過來即可。）
- [x] **2B-6**（worker 部分）驗證通過：new-cpc-worker `/healthz` 200、`/approval/templates`＋`/board` 200 回 CPCTR 資料；news-response-llm `/api/generate` 405(存活)。LIFF/LINE 冒煙測試待 2C 網域接上再做。

### 2C. DNS 段（最後、可回退）

- [ ] **2C-1** 前置查證：Cloudflare 跨帳號自訂網域限制（zone 在 589411、Pages/Worker 在 589411a）。查完把結論記進本文件再動手。
- [ ] **2C-2** 備份：記錄 `new-cpc.com` zone 現有相關 DNS 記錄與 route 的「記錄名／現值／目標值」。
- [ ] **2C-3** 切換：`response.new-cpc.com` CNAME 指向 589411a 的 `*.pages.dev`；`/api/*` route 改指 589411a worker。zone 本身**留在 589411**（域名歸屬）。
- [ ] **2C-4** 驗證：正式網址全流程（LINE 登入、簽核看板、送簽通知）；LINE Developers 後台 webhook URL 若有變動同步更新。
- [ ] **2C-5** 回退預案：任何異常 → 依 2C-2 備份把 DNS 指回 589411（589411 側資源在穩定期內不拆，就是為了這一手）。

## Phase 3：收尾（Phase 2 後穩定 7 天）

- [ ] **P3-1** Joseph 授權後 DROP `cpc_old_*`（launchdock 混庫技術債清除）。
- [ ] **P3-2** 589411 側兩支 worker／Pages 下線或停用（保留 repo 作開發原本）。
- [ ] **P3-3** 更新 STATUS 與交接文件；若中油要求所有權轉移，屆時再把 GitHub repo ownership 正式轉給 589411a。

---

## 執行紀律

1. 每個勾選項完成即在本文件打勾＋一行證據（指令或截圖路徑），比照 harness P1：無紀錄＝未做。
2. 破壞性操作（rename、DNS 切換、DROP、下線）前先貼「將執行的指令＋回退方式」，Joseph 確認才動。
3. 卡住就標 BLOCKED＋原因，不繞道、不自行提權。
