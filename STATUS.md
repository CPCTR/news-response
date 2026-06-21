# STATUS — news-response

> 單一真相。每次離開前更新（全域憲法收尾鐵律）。
**最後更新：** 2026-06-21
**整體狀態：** 🟢 web/worker/案例庫已提交（`bb1ef08`，純本機未 push）

## 一句話現況
桃園煉油廠「新聞說明稿快速編輯程式」：表單勾關鍵字→Worker 代理 LLM 生稿→PR 式學習。
本機已跑起靜態站（8788）與 wrangler dev（8787）。**卡在 `reference_md_deidentified/` 6 檔殘留人名待決定怎麼清，未 push。**

## 下一個具體動作 ⭐
1. **你在瀏覽器實測長官具名功能**（http://localhost:8788 → 填表 → 生成 → 跳「具名確認」，預設對就 Enter）。
   先到「🗂 長官名單」把 ○○○ 換成真實現任姓名（公開資料）。
2. 實測 OK → commit 此功能（officials.json + UI + 治理文件兩類分流）。
3. 語音輸入校正（Web Speech API + Haiku 術語/錯字/職稱校正，接 Phase 3 glossary.json）。
4. push 到 private repo（歷史已乾淨，等 Joseph 指示）。

## 未提交改動（2026-06-21，待一起 commit）
- 長官/民代具名 + 具名確認面板（officials.json）；語音輸入 + 預校正詞庫（corrections.json）。
- 治理：CONSTITUTION 條目六 / CLAUDE.md 改兩類分流。
- **Worker 模型升級**：GH_MODEL gpt-4o→**gpt-5-chat**（免費、品質大升）；worker.js 自動依模型挑
  `max_tokens` / `max_completion_tokens`（支援 gpt-5/o3/o4 推理版）。
- **出稿格式修正**：本文乾淨無 (來源:)/[待確認]，溯源與待確認改列「【內部審查註記（請勿對外）】」；
  複製/LINE/學習只取對外本文（publicDraft）。已實測 gpt-5-chat 出稿符合。
- 本機：worker/.dev.vars（gitignored）放 GITHUB_TOKEN + ALLOWED_ORIGIN=localhost:8788 解 CORS。
- ⏳ 待辦：#2 表單一致性檢查（廢水↔油料處置不相容提醒）；官方姓名填入 officials.json。

## 已完成
- ✅ 去識別化收尾：單一乾淨 commit、全歷史零殘留人名（2026-06-21）。
- ✅ 長官/民代具名功能（2026-06-21，未 commit）：
  - `officials.json`（公開資料、build 內嵌）+「🗂 長官名單」編輯器（含最後確認日）。
  - 生成前「具名確認」面板：預設姓名正確直接 Enter；逾 180 天未確認標⚠；`○○○` 佔位不具名。
  - 確認的姓名注入 prompt「具名規則」；憲法條目六/CLAUDE 改為兩類分流。
  - 驗證：build OK、JS 語法 OK、純邏輯單元測試全過、頁面 200。

## 去識別化結果（2026-06-21 完成）
- 方針：人名（含公眾人物，因會退休/調職）一律降為**級職**，保留級職與**權責單位**。
- 工具：`scripts/deidentify.py`（規則層）+ 本機 gitignored 對照表 `scripts/name_map.local.json`
  （含人名，不入庫；由 Opus 子代理掃全庫複核產出）。執行 `--apply`。
- 成果：正文 38 檔去名、3 檔改名；清除 40+ 人名與員工 CPC email。
- 驗證：正文+檔名+檔頭+report 殘留人名 = 0；單位名稱完整保留。

## 定位
桃園煉油廠危機/輿情新聞說明稿快速編輯器，給公關承辦用；治理見 CONSTITUTION/FRAMEWORK。

## 怎麼驗證這一步成功
`python scripts/build_html.py` 跑得出 web/index.html，本地打開正常。

## 卡點 / 待你決定
- 專案定位與目標產出尚未明確界定。

## 進度脈絡（新的在上）
- 2026-06-19 起草此 STATUS
- 2026-06-14 init：憲法/框架/知識庫/題庫/去識別化素材庫

## 已知坑
- 去識別化素材庫涉及機敏資料，commit 前務必確認無真實個資。
