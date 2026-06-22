# 階段四：建 RAG／題庫

讓本單位的生成有「同單位歷史案例」可檢索。資料分兩種來源，處理方式不同。

## 來源 A：單位自有稿件（最高品質，優先）
1. 原始檔（速報/新聞稿）放 `doc/`——**永不進 git**（.gitignore 已擋）。
2. 跑去識別化：`python scripts/deidentify.py`（產去名 .md）；確認殘留=0（手機/員編/姓名）。
3. 跑 `python scripts/extract_case_card.py` 把去識別化稿件抽成 `cases/*.json`。
4. 這些 case `verified:true`、`source:"unit"`，可當 few-shot 與檢索底庫。

## 來源 B：網路新聞萃取情境（種子，補空窗）
- 用階段二的「題庫情境」與結構化萃取，寫成 `cases/web_*.json`，標 `source:"web"`、`verified:false`。
- **只存結構化欄位**（date/title/event_kind/location/equipment/dispute/official_response/outcome），
  不存新聞全文；人名去除。
- 用途：冷啟動時提供「這類事件長怎樣＋官方怎麼回」的參考，待單位有真實稿件後逐步替換。

## 題庫（測試與調校用）
- 每個 event_type 至少 1 題：情境敘述 ＋ 應勾選要素 ＋ 期望稿件重點 ＋ 是否應對外。
- 放 `docs/事件題庫.md` 的單位版（或 `units/<key>/quiz.md`），用來驗收生成品質與訓練使用者。

## 檢索接法（沿用 FRAMEWORK 附錄A，不做向量）
- 生成時依勾選的 event 標籤，從 `cases/` 撈 2~3 筆最相似注入 prompt。
- 優先 `verified:true` 的單位自有案例；web 種子僅在沒有單位案例時補位。

## 收尾檢查
- `cases/` 內無個資殘留（再跑一次 PII 掃描）。
- web 種子與單位案例可由 `source` 欄位區分。
