# STATUS — news-response

> 單一真相。每次離開前更新（全域憲法收尾鐵律）。
**最後更新：** 2026-06-21
**整體狀態：** 🟢 web/worker/案例庫已提交（`bb1ef08`，純本機未 push）

## 一句話現況
桃園煉油廠「新聞說明稿快速編輯程式」：表單勾關鍵字→Worker 代理 LLM 生稿→PR 式學習。
本機已跑起靜態站（8788）與 wrangler dev（8787）。**卡在 `reference_md_deidentified/` 6 檔殘留人名待決定怎麼清，未 push。**

## 下一個具體動作 ⭐
1. **你 review**：`git diff reference_md_deidentified`（人名→職稱、單位保留；38 檔內文+3 檔改名）。
2. review OK → 我 commit 去識別化變更，並 **squash 全部 3 個 commit 成 1 個乾淨 commit**
   （因人名也在 init `b82f413`，squash 後歷史不留名字）→ 才能 push 到 private repo。
3. 設 `worker/.dev.vars`（GITHUB_TOKEN）+ 本機把 wrangler.toml 的 ALLOWED_ORIGIN 暫改 localhost，即可實測生成。

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
