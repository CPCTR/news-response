# 階段三：生成單位包

把階段一（身分）＋階段二（新聞分析）合成四個會注入網頁的檔案。對照黃金樣板（根目錄桃園檔）
的「結構」，但內容依本單位重生。每生一檔，列重點給使用者確認再寫入。

## options.json
- 六群組固定：`loc`(地點/設備) `mat`(物質) `cause`(原因) `status`(現況) `handle`(處置) `stmt`(補充句)。
- 來源：階段二的詞彙抽取 ＋ 階段一的設備/物質清單。每群組 5~10 項，挑**最常勾、最具體**的。
- `cause/status` 可保留通用項（設備故障/原因仍待查證中/已成立緊急應變中心/已排除），其餘換成本單位用語。
- `stmt` 換成本單位口吻（用 unit_profile.mission_statement / good_neighbor_closing 改寫）。

## knowledge_base.json
- `meta`：填單位名、source（註明含網路新聞分析）。
- `official_templates.press_release`：由 `unit_profile.json` 展開——header/closing/footer/電話/發言人層級。
- `global_response_principles`、`publication_decision`：**沿用範本**（通用），只把「廠/站外」等字眼順本單位。
- `event_types`：**從零重生**。用階段二的事件型態頻譜，每類填 id/name/definition/typical_disputes/
  response_tone/public_default/severity_pattern/cases。web 來源 case 標 `source:"web"`、`verified:false`。
- `few_shot_examples`：1~3 篇。優先單位自有去識別化稿件；無則由代表新聞改寫情境，標 `source:"web"`。

## corrections.json
- 通用：`中油公司→台灣中油` 等。
- 本單位：階段二抓到的易誤寫/誤聽專有名詞（設備名、化學品名、地名）。

## officials.json
- 由階段一填好；company 級可沿用根目錄並請使用者確認現任。

## 自我檢查（寫入前）
- event_types 是否真的反映**本單位**而非煉油廠？（若看到「煉製/航空燃油」殘留＝沒重生乾淨）
- OPTIONS 是否出現本單位不可能有的設備/物質？
- 四檔都是合法 JSON（`python -c "import json;json.load(open(...))"`）。
- 無第三方個人姓名；未確認數字標 `[待確認]`。
