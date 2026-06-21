# CLAUDE.md — 給 @claude PR 代理的工作守則

本檔讓 Claude Code Action（`@claude`）理解本專案，做出正確、可審的變更。

## 專案是什麼
桃園煉油廠「新聞說明稿快速編輯程式」。使用者在網頁勾選結構化關鍵字 → 呼叫 LLM 生成新聞稿草稿。
治理層在 `CONSTITUTION.md`（不可違反）與 `FRAMEWORK.md`。

## 鐵律（凡變更都要遵守）
1. **嚴守 `CONSTITUTION.md`**：任何內容、範例、RAG 條目都不得含個資（手機/員編/姓名），人名一律以職稱或 ○○○ 表示。
2. 危機初期用語不認責、不臆測原因、不承諾賠償。
3. 你只開 **PR**，由人工審核 merge；絕不直接 push 到 master。

## 最常見任務：新增表單關鍵字（對應使用說明書 P20–21）
網頁的勾選選項由 **`web/index.html` 裡的 `OPTIONS` 物件** 驅動（不是寫死在 HTML 標籤）。
要新增一個關鍵字，例如在「涉及物質」加「永續航空燃油（SAF）」：

1. 編輯 `web/index.html`，在 `OPTIONS.mat` 陣列加入該字串。
   群組對應：`loc`=地點或設備、`mat`=涉及物質、`cause`=原因、`status`=目前情況、`handle`=處置方式、`stmt`=補充說明。
2. 若該關鍵字需要 grounding，知識/RAG 條目寫進 **`knowledge_base.json`**（本專案的 RAG 來源；
   結構見現有內容：`event_types`、`few_shot_examples`、`official_templates`）。
3. **務必重建頁面**：`python scripts/build_html.py`，它會把 `knowledge_base.json` 內嵌進 `docs/index.html`（GitHub Pages 服務 /docs）。
4. 開 PR，PR 說明列出：改了哪些選項、新增哪些 RAG 條目、是否已重建 docs、有無個資風險。

## 其他檔案
- `worker/` Cloudflare Worker（LLM 代理：GitHub Models 免費為主，Anthropic 備援）。
- `scripts/extract_case_card.py` 從新聞稿抽案例卡；`scripts/generate_draft.py` 由事件生草稿。
- `reference_md_deidentified/` 去識別化歷史素材（可讀）；`doc/` 原始含個資，**永不進 git，勿讀取外洩**。

## 驗證
改完跑 `python scripts/build_html.py` 應成功；`docs/index.html` 能在瀏覽器開、表單與按鈕正常。
