# 部署指南 — 新聞稿助理

架構分兩個面：**學習面（GitHub Actions，非同步）** 與 **互動面（GitHub Pages + Worker，即時）**。

```
新聞稿 merge ─▶ Action 抽案例卡 ─▶ 開 PR 給你審        （學習面，慢無所謂，金鑰在 Actions）
開 Issue 填事實 ─▶ Action 生成初稿 ─▶ 開 PR            （學習面）
網頁勾選關鍵字 ─▶ 打 Worker ─▶ GitHub Models(免費) ─▶ 即時草稿  （互動面，金鑰在 Worker）
                              └▶ 額度用盡自動 fallback Anthropic
網頁：📋 複製 / 💬 分享到 LINE
```

> 為什麼要 Worker：GitHub Pages 是純靜態，金鑰放瀏覽器會外洩。Worker 是唯一能安全用 GitHub Models 免費額度又即時回應的方式。

---

## 0. 建 repo 並推上去
```bash
cd news-response
git add -A && git commit -m "feat: 學習面 Actions + 互動面 Worker + 複製/LINE"
gh repo create news-response --private --source=. --push   # 或自行 git remote add
```

## 1. 啟用 GitHub Pages
Repo → Settings → Pages → Source 選 **Deploy from a branch** → branch `master`、資料夾 **/docs** → Save。
幾分鐘後得到網址（之後可在 Cloudflare 綁 `news-response.launchdock.app`，流程同 daily-bread）。
> 改動網頁後務必 `python scripts/build_html.py` 重建 `docs/index.html` 再 push。

## 2. 開啟 GitHub Models（學習面要用）
- 帳號層級：到 https://github.com/settings/ → 啟用 Models（若組織需管理員開）。
- 兩個 workflow 已加 `permissions: models: read`，用 Actions 內建 `GITHUB_TOKEN` 即可，**不需另存 PAT**。
- 確認 `worker/` 與 workflow 裡的 `GH_MODEL`（預設 `openai/gpt-4o`）在 Models catalog 存在。

## 2.5 啟用 @claude PR 代理（自動改前端/RAG 並開 PR）
對應使用說明書 P20–21：在 Issue/PR 留言 `@claude …` 就自動改檔、開 PR。
1. 在本機 Claude Code 跑 `/install-github-app`，授權這個 repo（會自動建議 workflow，本repo已附 `.github/workflows/claude.yml`）。
2. Repo → Settings → Secrets and variables → Actions → 新增 `ANTHROPIC_API_KEY`。
3. 用法：開一個 Issue 貼上新聞事件，留言：
   > `@claude 針對這則新聞，在「涉及物質」勾選區新增「永續航空燃油（SAF）」，並在 knowledge_base.json 補對應條目，重建 docs 後開 PR。`
   代理會依 `CLAUDE.md` 守則改 `web/index.html` 的 `OPTIONS`、更新知識庫、跑 `build_html.py`、開 PR 給你審。

## 3. 部署 Worker（互動面）
```bash
cd worker
npm i -g wrangler && wrangler login
# 編輯 wrangler.toml：ALLOWED_ORIGIN 改成你的 Pages 網域、GH_MODEL 確認
wrangler secret put GITHUB_TOKEN          # 貼 GitHub PAT，勾 models:read
wrangler secret put ANTHROPIC_API_KEY     # 選用：額度用盡時的備援
wrangler deploy
```
拿到 `https://news-response-llm.<帳號>.workers.dev`。

## 4. 設定網頁後端
打開 Pages 網址 → ⚙ 右上設定 → 後端模式留「Worker 代理」→ 貼上 Worker 網址 → 儲存。
（沒部署 Worker 也能用：切「瀏覽器直連 Anthropic」自帶金鑰。）

---

## 用法
- **生成**：填事件 → 分析 → 勾要點 → 生成草稿 → 編輯 → 複製 / 分享 LINE。
- **學習新寫法**：把去識別化新聞稿放進 `reference_md_deidentified/` 並 push → `learn-from-pr` 自動抽案例卡、開 PR → 你審核 merge，知識點進 `cases/`。
- **發 PR 生初稿**：開 Issue 選「新聞稿初稿請求」表單填事實 → `generate-draft` 生成、開 PR。

## 本機測試
```bash
python scripts/build_html.py && open docs/index.html        # 看網頁
python scripts/generate_draft.py "測試事件…"                  # 需先 export GITHUB_TOKEN
python scripts/extract_case_card.py reference_md_deidentified/某篇.md
cd worker && wrangler dev                                     # 本機跑 Worker
```

## 隱私（沿用既有兩道防線）
- `doc/`（原始含個資）永不進 git（`.gitignore` 已擋）。
- 學習面開的是 **PR 不是直接 commit**，你 merge 前務必檢查殘留個資。
- 對外稿不得含手機/員編/姓名（憲法條目，前端已有 PII 偵測警示）。
