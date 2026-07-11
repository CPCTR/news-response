# 交接文件 → Fable（Claude Cowork 規劃層）

**產出者：** Claude Code（本機執行手，wrangler/CLI 直通）
**日期：** 2026-07-11
**用途：** 讓 Fable 據此改寫/收斂 migration runbook。內容全部經本機檔案或 live 指令驗證，可直接採信。
**一句話：** 你 runbook 假設的「搬遷」本次**大致已完成並驗證**；真正還剩的不是搬遷本身，而是「移交到 589411a 帳號」這個**尚未開始**的獨立任務。

---

## 0. 指揮架構（三層，已對齊）
- **Fable（你）**：規劃、對帳、驗收、產 runbook。
- **輿情 subagent**：挖來源，不涉搬遷。
- **Claude Code（我）**：拿 589411 的 token，本機跑 wrangler / supabase CLI / curl。Token 走本機環境變數，不進雲端對話。

---

## 1. ⚠️ 對帳：搬遷已完成，不是待辦

| 項目 | 你 runbook 的假設 | 地面實況（已驗證） |
|---|---|---|
| 8 張 `cpc_*` + `news_drafts` | 待 dump/restore 到 CPCTR | ✅ 已在 CPCTR（ref `bqgsgfnxdlmrhmeyxkfq`，東京），列數與 launchdock 一致 |
| Worker 重指 Supabase | 待重部署 | ✅ `new-cpc-worker` 的 `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` 已改指 CPCTR；curl `/approval/templates`+`/approval/board` 回 200 |
| LINE OAuth | — | ✅ 100% 完工，真人登入實測通過 |
| anon key | — | ✅ CPCTR publishable key `sb_publishable_445I76…` 已填前端 |
| Google provider | — | ⏳ 已建、curl 線路驗證通過，**剩真人登入點一次**（Joseph）|

> **結論：** runbook 若照原框架，會叫 CC 重做已完成且已驗證的搬遷 → 有覆蓋風險。請改瞄準第 5 節「真正還剩的」。

---

## 2. 🧩 兩支 Worker（你的 secret 清單把兩支混在一起了）

| Worker | Repo 路徑 | 碰 Supabase? | KV / AI binding | 線上已存 secrets |
|---|---|---|---|---|
| **`news-response-llm`** | `news-response/worker/` | ❌ 純 LLM proxy | ❌ 無 | `GITHUB_TOKEN`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `APP_KEY` |
| **`new-cpc-worker`** | `new-cpc/worker/` | ✅ 簽核 bot | KV `TIERS`=`f1a9aa3105f74319897673d31ea1b019` + Workers AI `AI` | `ANTHROPIC_API_KEY`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_TOKEN`, `SUPABASE_SERVICE_KEY`（選填 `OPENROUTER_API_KEY`, `OLLAMA_API_KEY`, `APP_KEY`）|

**釐清你原清單的歸屬：**
- `LINE_CHANNEL_TOKEN` / `LINE_CHANNEL_SECRET` / `LINE_LOGIN_CHANNEL_ID` → 屬 **new-cpc-worker**。
- `SUPABASE_SERVICE_KEY` → 只在 **new-cpc-worker**。
- `OPENROUTER_API_KEY` / `APP_KEY` → 兩支都有。
- `SUPABASE_URL` → 是**明文 var 不是 secret**（見下）。

**vars 不用擔心：** new-cpc-worker 的 13 個明文 var 已從線上 settings API 完整取回進 `wrangler.toml`（含 `SUPABASE_URL`、`LINE_LOGIN_CHANNEL_ID`、`ALLOWED_ORIGIN`、gateway chain 等）。真正 write-only、手上要有原值的**只有 secrets**；而且它們已在線上，`wrangler deploy` **不會覆蓋既有 secret**。

---

## 3. 🔑 三個帳號一定要分清楚（最易混、最該詳交待）

> 三個 Google 帳號長得像但**用途完全不同**：`589411`、`589411a`（有 a）、`jjaimark1`。
> **一句話記法：** 搬遷只牽涉 **589411（現有 infra）** 與 **589411a（中油自有目的地）** 兩個；**jjaimark1 與本次 migration 完全無關**，別拉進來。

### 帳號 A — `589411@gmail.com`（Joseph 主帳號 = 現有 infra 所在）
- **角色：** 目前**所有** news-response / new-cpc 線上資源的家，也是搬遷的**執行 token 帳號**。
- **Cloudflare：** account id `0b3e3ff0e2881933499cc1a93e8661c5`。hosts：
  - Worker `news-response-llm`（`news-response-llm.589411.workers.dev`）
  - Worker `new-cpc-worker`（`new-cpc-worker.589411.workers.dev`）
  - Pages：hub + apps（`news-response.pages.dev` 等）
  - **DNS zone `new-cpc.com`**（域名是 589411 買的，DNS 續留這裡）
  - Cloudflare Access（`response.new-cpc.com` 的登入閘）
  - KV：`TIERS`（`f1a9aa31…`）等
- **GitHub org：** `589411/*`——news-response、new-cpc、memory、masters-hub、launchdock 全部（已用 `git remote` 驗證）。
- **Supabase：** launchdock 專案（**舊**後端，正被搬離；第 5 節 #3 待刪）。MCP **碰得到**（Joseph 主帳號）。
- **wrangler 現況：** ✅ 本機**現在就登入 589411**，token scopes 含 workers / **workers_kv** / d1 write → CC 對兩支 worker + KV **現在就能直接操作，不需 Joseph 重登**。（`wrangler whoami` 已驗證。）

### 帳號 B — `589411a@gmail.com`（**有 a** = 中油自有帳號 = 搬家目的地）
- **角色：** 中油自己的帳號，是「完整移交」的**目的地**。
- **Supabase：** **CPCTR** 專案（ref `bqgsgfnxdlmrhmeyxkfq`，org `CPCTR's Org`，AWS 東京）——**新**後端，8 張 `cpc_*` + `news_drafts` 已搬入。
- **MCP 碰不到**（非 Joseph 主帳號）→ 只能靠 **cic（Claude in Chrome）** 儀表板 / SQL Editor 操作；抓 anon key 時用的是 cic 分身「589411a@gmail.com」。
- **Cloudflare（未來）：** 目前**還沒**有本專案資源；第 5 節 #4「完整移交」時才會把 repo + Pages + Worker 建到這裡，**需要 589411a 的 Cloudflare 互動登入**（Joseph 跑）。
- ⚠ **別混：** 589411a **不是**現在跑搬遷的 token 帳號；現在的 token 是 589411（帳號 A）。

### 帳號 C — `jjaimark1@gmail.com`（ChatGPT 顯示名 JosephnJoy / 作者 張彥堂，有 Plus）
- **角色：** **AI 助理的作者帳號**——masters-hub 的 22 位大師 **Gem（Gemini）+ GPT（ChatGPT）全建在這裡**。要新增/編輯大師才用它登入。
- **與本次 migration 完全無關**：不是 GitHub org、不是本專案的 Cloudflare/Supabase 帳號。
- ⚠ **唯一會混的原因：** 舊 STATUS（`news-response/STATUS.md` #3）誤記「wrangler 現登入 jjaimark1」——**已過時、是錯的**。實測 wrangler 登的是 589411。**runbook 不要出現 jjaimark1。**
- （旁註：個人 Google 帳號 589411 分享 Gem 會被 Workspace 閘門擋，jjaimark1 不會——所以大師選它，純 masters-hub 脈絡。）

### 一頁對照表
| 帳號 | 用途 | Cloudflare | Supabase | GitHub | MCP 可達? | migration 角色 |
|---|---|---|---|---|---|---|
| **589411** | 現有 infra + 執行 token | ✅ 兩 worker/Pages/DNS/Access（`0b3e3ff0…`）| launchdock（舊，待刪）| `589411/*` 全部 | ✅ | **來源 + 執行帳號** |
| **589411a**（有 a）| 中油自有、搬家目的地 | ⏳ 未來才建 | **CPCTR**（`bqgsgfnxdlmrhmeyxkfq`，新）| 未來鏡像/轉移 | ❌ 只能 cic | **目的地** |
| **jjaimark1** | 大師 Gem/GPT 作者 | ❌ 無關 | ❌ 無關 | ❌ 無關 | — | **無關，別拉進來** |

- **兩支 worker 源碼都已進版控**（new-cpc-worker 於 2026-07-10 從部署版反建取回，`node --check` 過；功能等價、非位元組一致，redeploy 前照 README 檢查清單）。

---

## 4. 📊 Live 佐證（CC 用 589411 token 實測，2026-07-11）
- `wrangler kv key list --namespace-id f1a9aa3105f74319897673d31ea1b019` → **`[]`（0 筆）** → **沒有 KV 資料要搬**。runbook「KV 資料搬遷」這條可刪。
- `wrangler deployments list --name new-cpc-worker` → 打得到，current version `7b053e2c`（2026-07-03）→ CC 對它的 worker/KV 操作是通的。
- `wrangler whoami` → 589411@gmail.com，account `0b3e3ff0e2881933499cc1a93e8661c5`，scopes 含 workers_kv write。

---

## 5. ✅ 真正還剩的（runbook 該瞄準這 4 項）

| # | 項目 | Owner | 狀態 / 前置 |
|---|---|---|---|
| 1 | Google 真人登入實測（稿件庫「以 Google 登入」點一次）| Joseph | 前置：Google Cloud OAuth redirect URIs 含 `https://bqgsgfnxdlmrhmeyxkfq.supabase.co/auth/v1/callback`、consent screen 已 Publish |
| 2 | Cloudflare Access 員工 Gmail 白名單（成本控管：生稿會 call LLM）| Joseph | 在 589411 Zero Trust dashboard 改（CC 不代動存取控制），需 Joseph 給 Gmail 名單 |
| 3 | 🔴 刪 launchdock 舊 `cpc_*`（破壞性）| Joseph 拍板 → CC/cic 執行 | 正式站確認無誤後**先問 Joseph** 才動 |
| 4 | **完整移交 infra 到 589411a**（唯一像「搬家」的大任務，**尚未開始**）| CC + Joseph | 見下方拆解 |

### #4 移交 589411a 的建議 runbook 形狀（分三段、每段驗證）
> 這才是你 runbook 真正該寫的「搬家」，且需要 **589411a 的 Cloudflare 登入**（互動，Joseph 跑）。
1. **repo 段**：`589411/news-response`、`589411/new-cpc` → 轉/鏡像到 589411a 的 GitHub（先 push 再動 Cloudflare）。
2. **Cloudflare 段**：Pages（hub + apps）+ 兩支 Worker 在 589411a 重建/部署；secrets 逐一 `wrangler secret put --name …` 重設（值 Joseph 手上要有：`SUPABASE_SERVICE_KEY`=CPCTR secret、`LINE_CHANNEL_TOKEN`/`SECRET`=LINE 後台、各家 LLM key）。KV `TIERS` 空的、免搬（新帳號建空 namespace 即可）。
3. **DNS 段**：DNS zone `new-cpc.com` **留 589411**（域名是 589411 買的）；把 `response.new-cpc.com` 及 `/api/*` route 從 589411 Pages/Worker **改指 589411a**。
   - ⚠ **跨帳號自訂網域坑**：Cloudflare Pages 自訂網域通常要求 zone 與 Pages project 同帳號。zone 在 589411、Pages 在 589411a 屬跨帳號 → 需 CNAME 到 589411a 的 `*.pages.dev` 並處理 SSL 驗證。執行前先查 Cloudflare 跨帳號自訂網域限制。
   - ⚠ DNS 改錯站直接掛：動前記錄「改哪筆 / 目標值 / 現值備份」。

---

## 6. CC 可立即執行的指令參考（589411 帳號，值用佔位符）
```bash
# 現況查核（唯讀，隨時可跑）
cd ~/github/new-cpc/worker && npx wrangler whoami
npx wrangler deployments list --name new-cpc-worker
npx wrangler kv key list --namespace-id f1a9aa3105f74319897673d31ea1b019   # → []

# 若要改 new-cpc-worker 的 secret（589411 帳號，值不進 git）
echo '<VALUE>' | npx wrangler secret put SUPABASE_SERVICE_KEY --name new-cpc-worker
# ⚠ SUPABASE_URL 是明文 var 不是 secret → secret put 會撞名(10053)；改它要 wrangler.toml redeploy 或 dashboard

# 重部署（會用本地 wrangler.toml 的 [vars] 覆蓋線上 vars；既有 secret 不動）
cd ~/github/new-cpc/worker && npx wrangler deploy
```

---

## 7. 待 Joseph / Fable 拍板的開放決策
1. 現在先動 #4（移交 589411a）？還是等 #1/#2 驗完再移交？
2. #3（刪 launchdock 舊 cpc_*）要不要現在排時程（仍需正式站確認 + 明確授權才動）。
3. #4 的 GitHub repo 是「轉移所有權」還是「589411a 建鏡像、589411 留備份」？影響 runbook 寫法。

---
*本文件對應 STATUS 來源：`news-response/STATUS.md`、`new-cpc/STATUS.md`（後端搬遷詳情以前者為主）。*
