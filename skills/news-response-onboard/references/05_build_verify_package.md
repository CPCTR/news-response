# 階段五、六：建置、驗證、打包、收尾

## 建置
```
python scripts/build_html.py --unit <unit_key>     # → docs/<unit_key>/index.html
```
- 缺非必要檔（officials/corrections）會跳過注入、用網頁預設；options 與 knowledge_base 為必要。
- 失敗多半是 JSON 不合法或單位資料夾不存在——照錯誤訊息修。

## 驗證（不准只靠閱讀宣稱完成）
1. **開頁面**：本機起 server 開 `docs/<key>/index.html`，確認六群組勾選框長出**本單位**詞彙（非煉油廠）。
2. **跑一題**：拿階段四題庫的一題，實際勾選→生成→看是否套到本單位抬頭/事件類型/語氣。
3. **PII 掃描**：對 `units/<key>/` 與 `cases/` 全掃手機/員編/第三方姓名；殘留=0 才算過。
4. **JSON 合法**：四個注入檔都 `json.load` 通過。
5. **差異感**：對照桃園版，確認「設備/物質/事件」確實換成本單位的（沒有殘留煉製/航空燃油）。

## 打包（安裝包）
新單位要能拿自己的 Claude 訂閱或 LLM API 跑起來，交付內容：
- 整個 repo（含共用框架）＋ 該單位 `units/<key>/`＋建好的 `docs/<key>/`。
- 後端：沿用 `skills/llm-proxy-worker` 部署各單位自己的 Worker（或共用一支、用 APP_KEY 區分）。
- 一頁 `units/<key>/DEPLOY.md`：列本單位的 Worker URL、build 指令、待單位回覆的 TODO。

## 收尾（憲法收尾鐵律）
- 更新根目錄 `STATUS.md`：新增本單位狀態與「下一個具體動作」。
- 列「**範本待替換清單**」交給單位窗口：哪些 `○○○`/`[待確認]`/web 種子 case 待換成正式資料。
- 有意義進展就提醒 Joseph commit（小步提交）。
