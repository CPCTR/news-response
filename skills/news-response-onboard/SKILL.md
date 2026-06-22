---
name: news-response-onboard
description: >
  把「新聞說明稿快速編輯程式」導入一個新的台灣中油單位（桃園煉油廠以外）。以桃園煉油廠為樣板，
  透過訪談採集單位身分＋網路新聞採集分析，產出該單位專屬的勾選詞彙(OPTIONS)、知識庫(event_types/
  官方版型/few-shot)、首長名單、預校正表，建立專屬 RAG／題庫，建置成可部署的網頁安裝包。
  當使用者要：導入/搬到新單位、為某接收站/油庫/加油站處/探採區建一套新聞稿助理、
  從過去網路新聞分析打造題庫與資料庫、複製煉油廠這套給別的單位用時使用。
---

# news-response-onboard — 新單位導入精靈

把這套助理從「桃園煉油廠」複製到**任一中油單位**。共用框架不動，只重生單位專屬層。
產物是一個 `units/<unit_key>/` 單位包，`build_html.py --unit <key>` 即可建出該單位的網頁。

## 共用 vs 單位專屬（先建立心智模型）

- 🔵 **共用框架（不要改）**：`CONSTITUTION.md`、`FRAMEWORK.md`、`prompts/`、`worker/`、
  `scripts/build_html.py`、`web/index.html` 的 UI 與 prompt 組裝、危機溝通原則、刊登決策邏輯。
- 🟠 **單位專屬（本 skill 重生）**：`options.json`、`knowledge_base.json`、`officials.json`、
  `corrections.json`、`unit_profile.json`、RAG 素材 `cases/`。
- 範本在 `units/_template/`；黃金樣板＝根目錄的桃園檔（唯讀參考，**不要覆蓋**）。

## 鐵律（沿用憲法，全程不可違反）

1. **不臆測身分**：首長/民代姓名須正確，不確定一律 `○○○`；員工/民眾/傷亡者去名。
2. **網路新聞＝參考情境**：由新聞萃取的 case/few-shot 標 `source:"web"`、`verified:false`，
   是「題庫」不是權威事實；具體數字未經單位確認標 `[待確認]`。
3. **去識別化**：任何含個資素材入庫前跑 `scripts/deidentify.py`，確認殘留=0；原始檔不進 git。
4. **event_types 從零依該單位實況重生**，不沿用煉油廠分類（煉油廠的 11 類僅供參考菜單）。
5. 全程**繁體中文（台灣）**與使用者溝通。

## 流程（六階段，逐階段跟使用者確認，不要一次跑完）

> 每階段結束問使用者「這樣對嗎、要補什麼」再進下一階段。產物寫進 `units/<unit_key>/`。

1. **訪談採集** → 填 `unit_profile.json` ＋ 首長名單。見 `references/01_interview.md`。
2. **網路新聞採集分析** → 蒐集這類單位過去公開新聞，歸納事件型態、設備/物質詞彙、敏感爭點。
   見 `references/02_web_research.md`。
3. **生成單位包** → 由前兩步產出 `options.json` / `knowledge_base.json` / `corrections.json` /
   `officials.json`。見 `references/03_generate_pack.md`。
4. **建 RAG／題庫** → 把單位自有稿件與新聞萃取情境去識別化、轉成 `cases/`＋few-shot。
   見 `references/04_rag_and_quiz.md`。
5. **建置與驗證** → `python scripts/build_html.py --unit <key>`，開頁面、PII 掃描、勾選測試。
   見 `references/05_build_verify_package.md`。
6. **打包與收尾** → 輸出部署包與「範本待替換」清單，更新 `STATUS.md`。
   見 `references/05_build_verify_package.md`。

## 啟動方式

問使用者三件事即可開始：(a) 單位是哪一個（全名/事業部）、(b) 手上有沒有該單位的速報/新聞稿、
(c) 這台機器能不能上網（決定第 2 階段用 WebSearch 還是改人工貼新聞）。
然後 `cp -r units/_template units/<unit_key>` 起一份草稿，逐階段填。
