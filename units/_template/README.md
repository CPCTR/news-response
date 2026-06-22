# 單位包（unit pack）範本

一個「單位包」= 把新聞說明稿助理導入**某一個中油單位**所需的全部單位專屬資料。
共用框架（憲法、原則、生成管線、UI）不在這裡，由 repo 根目錄與 `prompts/` 提供。

## 檔案清單

| 檔案 | 用途 | 是否注入網頁(runtime) | 由誰填 |
|---|---|---|---|
| `unit_profile.json` | 單位身分單一事實來源（全名/抬頭/發言人層級/電話/角色定位） | 否（授權生成用） | 訪談採集 |
| `options.json` | 勾選框詞彙：地點/設備、物質、原因、現況、處置、補充說明 | **是** → `<script id="options">` | 訪談＋新聞分析生成 |
| `knowledge_base.json` | 官方版型(official_templates)＋事件類型(event_types)＋few-shot＋原則＋刊登決策 | **是** → `<script id="kb">` | 樣板改寫＋新聞分析生成 |
| `officials.json` | 公開職務首長/民代名單（姓名須正確、不臆測；不確定填 ○○○） | **是** → `<script id="officials">` | 訪談採集 |
| `corrections.json` | 語音/輸入預校正對照（專有名詞） | **是** → `<script id="corrections">` | 訪談＋新聞分析生成 |

## 建置

```
python scripts/build_html.py --unit <unit_key>     # → docs/<unit_key>/index.html
```

## 重要原則（沿用憲法）

- **event_types 從零依該單位實況重生**，不沿用煉油廠分類。煉油廠的類別只當「參考菜單」。
- 對外稿一律去識別化：員工/民眾/傷亡者去名（職稱或 ○○○）；手機/員編不入稿。
- 由網路新聞萃取的案例＝「參考情境/題庫」，標 `source:"web"`、`verified:false`，非權威範本。
- 任何含個資的原始素材不進 git；RAG 素材入庫前跑 `scripts/deidentify.py` 確認殘留=0。
