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
> ⚠ **決策已定（Joseph, 2026-07-11）：走「整個給中油」→ 2C 原方案（域名留 589411）作廢，改由下方 `2C-alt` 執行。** 2C-1 查證結論保留供參。

- [x] **2C-1 查證結論（2026-07-11，Cloudflare 官方文件）**：跨帳號自訂網域**不能用原生 Custom Domain**——Workers/Pages Custom Domain 文件明寫「cannot create a Custom Domain on a zone you do not own」；`response.new-cpc.com` zone 屬 589411，589411a 加不了。可行路徑只有三條，**這是要 Joseph 拍板的決策點**：
  - **① 把 new-cpc.com 的 DNS zone 搬到 589411a**（技術最簡：同帳號自訂網域原生可用、免費自動 SSL）。域名「註冊/擁有」與「DNS zone 在哪帳號」是兩回事，可只搬 zone(改 NS)不動註冊。⚠ 但若 new-cpc.com 是用 **Cloudflare Registrar 在 589411 註冊**，Registrar 綁定 zone 同帳號、無法只搬 zone → 需先確認註冊在哪。此路**牴觸原「DNS 留 589411」決策**，要 Joseph 重新定調。
  - **② Cloudflare for SaaS（O2O 橘對橘自訂主機名）**：保留 zone 在 589411，589411a 開 SaaS custom hostname + fallback origin，589411 設 proxied CNAME + TXT 驗證。**保留原決策但最複雜、且 SaaS 是付費加值**（免費額度外要錢），Pages/Worker 與 SaaS 整合繁瑣。
  - **③ 589411 保留一層薄代理**指到 589411a：589411 仍在路徑上，**牴觸「完整移交」目的**，不建議。
  - **待 Joseph 決定走哪條，才寫 2C-2～2C-5 的確切 DNS 動作。** 前置事實待確認：new-cpc.com 註冊在哪（Cloudflare Registrar 589411？外部 registrar？）。
- [~] **2C-2～2C-5**（原「域名留 589411」方案）**作廢**，由 2C-alt 取代。

---

## Phase 2C-alt：整個移交（含域名 new-cpc.com）到 589411a

> 決策：new-cpc.com 是 Cloudflare Registrar 註冊、鎖在 589411，跨帳號原生自訂網域行不通；Cloudflare for SaaS 需 589411a 自己有 zone 且付費、對單站是殺雞用牛刀。故走**整個給中油**：域名 registrar 帳號間移到 589411a，之後同帳號原生接網域（免費 SSL）。
> **依據（Cloudflare 官方）**：`registrar/account-options/inter-account-transfer/`、`fundamentals/manage-domains/move-domain/`。
> **不斷站原則**：全程保留 589411 的 worker/Pages 當 fallback；589411a 已用原生網址驗證可用。破壞性步驟（改 DNSSEC、發起 move、cutover）動前貼指令+回退、Joseph 確認才動。

### 2Ca-0 前置盤點與備份（非破壞，先做）〔CC 用 589411 access ＋ Joseph〕
- [ ] **2Ca-0a** 用 589411（wrangler OAuth / dashboard）**匯出 new-cpc.com 全部 DNS 記錄**（不只 response，含 MX/TXT/其他子網域），存檔備份（scratchpad + 貼進本文件附錄）。
- [ ] **2Ca-0b** 盤點 589411 Zero Trust **Access policy**（response.new-cpc.com 的規則），記下以便在 589411a 重建。
- [ ] **2Ca-0c** 確認轉移前置：註冊 >10 天 ✅（到期 2027-06）／registry 無 pendingDelete·redemption·pendingTransfer／**註冊人 email 已驗證**／無 pending Change of Registrant／**DNSSEC 狀態**（要關）／zone 是否上鎖。
- [ ] **2Ca-0d** 備一把 **589411a 含 `Zone:Edit`＋`DNS:Edit`** 的 API token（現有 token 只有 Account 範圍，動不了 DNS）〔Joseph 建，存 Keychain `cf-589411a-zone-token`〕。

### 2Ca-1 在 589411a 建 zone + 重建 DNS（非破壞；zone 未 active 前不影響 live）
- [ ] **2Ca-1a** 589411a 把 **new-cpc.com 加成 site（Free 方案）**。⚠ 設定不會跟著 registrar move 搬 → **DNS 要在此手動重建**。
- [ ] **2Ca-1b** 依 2Ca-0a 備份，在 589411a **重建所有 DNS 記錄**（逐筆對齊；別漏非本站的記錄）。
- [ ] **2Ca-1c** 驗證：`dig @<589411a NS> new-cpc.com` 各記錄與備份一致（此時 NS 尚未生效，用指定 NS 查）。

### 2Ca-2 接原生自訂網域到 589411a Pages/Worker（同帳號，native、免費 SSL）
- [ ] **2Ca-2a** `response.new-cpc.com` → **news-response Pages** custom domain（`wrangler pages ... ` 或 dashboard）。
- [ ] **2Ca-2b** `/api/*` → **news-response-llm worker** route/custom domain（同帳號現在建得了；把先前 2B-3 註解掉的 route 用 589411a zone 版本恢復）。
- [ ] **2Ca-2c**（選）apex `new-cpc.com` / `www` → **hub Pages** custom domain。
- [ ] 註：zone 尚未 active 前這些不實際服務，但先設好，move 一生效即接上。

### 2Ca-3 網域 registrar 帳號間移轉（🔴破壞性 cutover，先確認）〔Joseph 兩帳號確認〕
- [ ] **2Ca-3a** 589411：**關 DNSSEC**、解 zone lock（若有）。
- [ ] **2Ca-3b** 589411 發起 **inter-account move** 到 589411a（account `ca3e37fa2f5e10d85031d34cb3b988fd`）。
- [ ] **2Ca-3c** 589411a **確認接受**。move 完成、NS 生效後 → 流量走 589411a zone、2Ca-2 自訂網域接上。
- [ ] **2Ca-3d** ⚠ 轉移後 **30 天鎖定**、續費改由 589411a 負責；來源帳號該網域設定全失（已於 2Ca-0/1 備份重建）。

### 2Ca-4 Access 白名單在 589411a 重建（併入原 P0-2）〔Joseph〕
- [ ] **2Ca-4** 589411a Zero Trust → Access app `response.new-cpc.com` → Allow + 員工 Gmail 白名單（存取控制 CC 不代動）。

### 2Ca-5 LINE / OAuth 校正
- [ ] **2Ca-5a** LINE Developers webhook URL 若指 589411 worker → 改指 589411a worker（或自訂網域 `new-cpc.com/line/webhook`）。
- [ ] **2Ca-5b** Supabase CPCTR OAuth callback / Site URL 確認仍對（網域未變、理應 OK，實測一次）。

### 2Ca-6 全流程驗證
- [ ] **2Ca-6** `response.new-cpc.com`（頁面 200）、`/api` 出稿、LINE 登入、簽核看板、送簽通知全走一遍。

### 2Ca-7 回退
- [ ] **2Ca-7** move **完成前**：完全可回退（未動註冊）。move **完成後**異常：zone 已在 589411a → 改 **589411a 的 DNS** 把 response/api 指回 589411 worker/Pages（fallback 未拆）；註冊本身 30 天內不能再 move。

## Phase 4：戰情室上雲（589411a 底座已就緒，可與 2C 平行）〔CC〕

> 規格＝`news-monitor/WARROOM_DEV_PLAN.md` §8.5c（雲端呈現）／§8.5d（通用截圖入庫 API）。589411a 的 Cloudflare（token/KV/Pages/Workers AI）在 2B 已備妥 → warroom worker 直接建在同帳號，不必等 2C 域名。
> **不與交付混庫**：warroom 用**獨立 worker**（不塞 new-cpc-worker）；資料先用 KV，日後 B軌上雲再遷 Supabase。

- [x] **4-1 token 自證通過**（2026-07-12）：`wrangler whoami`→589411a account `ca3e37fa2f5e10d85031d34cb3b988fd` ✅；`gh auth status`→登入 `589411`(scopes repo/workflow)、`gh repo view CPCTR/new-cpc`→PRIVATE 可見可推 ✅；Supabase CPCTR 非 MCP 可達(已知)，warroom 先用 KV 不需它 ✅。
- [x] **4-2 warroom worker 部署+驗證**（2026-07-12）：589411a `warroom-cpc.cpctr.workers.dev`（v57c2e531）。程式 `news-monitor/warroom-worker/`。KV `WARROOM`=`d80526bbb4cc4b04bb9ed02ec320b99e`。secrets(Keychain)：INGEST_TOKEN(新生 `cf-589411a-WARROOM_INGEST_TOKEN`)/ANTHROPIC/OPENROUTER。驗證：`/healthz` 200；ingest 無token→**401**、帶token→**200**；`GET /warroom/` 未登入/假token→登入頁；KV 三 key 原始API確認寫入(wrangler kv get 有讀取延遲、非 bug)。⚠ 三端點齊(ingest/ingest-image vision/view)。
- [x] **4-3 push_warroom.py 驗證**（2026-07-12）：推送成功、雲端收到真實資料(tiles=126)、失敗排隊`.warroom_push_queue/`補送清空。⚠ 坑：urllib 預設 UA 被 Cloudflare **error 1010** 擋 → 已加 `User-Agent: warroom-push/1.0`。token 從 env `WARROOM_INGEST_TOKEN`、URL `WARROOM_WORKER_URL`；payload 只含 json+html+generated_at，無憑證/原圖。
- [~] **4-4 中油可視**（白名單完成；手機版 ride 2Ca/4-6）：✅ 白名單已寫入 3 位中油人員（彥堂 `U06d23bb…`、曾怡瑄 `U3ea3c26…`、hang `U6cea770…`，uid 取自 launchdock `cpc_old_identities`）。⚠ **加人 SOP**：`curl -X PUT ".../storage/kv/namespaces/d80526…/values/warroom:allow:<uid>" -H "Authorization: Bearer <589411a token>" --data "<name>"`（**用 raw API，`wrangler kv key put` 會靜默失敗**）。星期一新人給 uid 即可批次加。⏳ **手機 LINE 登入實看**：現有 LIFF `2010579062-xDo4BzKa` 的 Endpoint 是 `response.new-cpc.com`（打不到 workers.dev 的 warroom）→ **待 2Ca 域名移交、warroom 綁 `new-cpc.com` 子網域後（4-6），沿用原 LIFF 即通**。雙時間戳+斷流橫幅已在 worker（4-2 已驗證邏輯）。
- [ ] **4-5 驗收**：手機(行動網路)LINE 登入看到戰情室；未帶 token 的 POST 被拒；斷流測試出現紅橫幅；grep 推送 payload 不含 FB 憑證/cookies。
- [ ] **4-6 域名接入**：2Ca 完成後，warroom 綁自訂網域（如 `warroom.new-cpc.com`）；未完成前用 `warroom-cpc.cpctr.workers.dev` 原生網址先給中油看。

## Phase 3：收尾（Phase 2 後穩定 7 天）

- [ ] **P3-1** Joseph 授權後 DROP `cpc_old_*`（launchdock 混庫技術債清除）。
- [ ] **P3-2** 589411 側兩支 worker／Pages 下線或停用（保留 repo 作開發原本）。
- [ ] **P3-3** 更新 STATUS 與交接文件；若中油要求所有權轉移，屆時再把 GitHub repo ownership 正式轉給 589411a。

---

## 執行紀律

1. 每個勾選項完成即在本文件打勾＋一行證據（指令或截圖路徑），比照 harness P1：無紀錄＝未做。
2. 破壞性操作（rename、DNS 切換、DROP、下線）前先貼「將執行的指令＋回退方式」，Joseph 確認才動。
3. 卡住就標 BLOCKED＋原因，不繞道、不自行提權。
