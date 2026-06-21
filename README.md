# 石化廠新聞稿撰寫助理（桃園煉油廠）

事件發生 → 速報事實 → 判斷是否對外 → 套版型生成草稿 → 人工修改 → 回填學習。
雙模型：**Sonnet 撰稿 → Opus 4.8 校正**。

## 結構
| 路徑 | 內容 | 進 git |
|---|---|---|
| `CONSTITUTION.md` | 憲法：不可違反的原則（事實/責任/法規/語氣/人機協作/隱私） | ✅ |
| `FRAMEWORK.md` | 框架：資料層、雙模型分工、流程、校正清單、回填迴圈 | ✅ |
| `knowledge_base.json` | 知識庫：11 類事件→爭點/回應基調/是否對外/few-shot；三份官方範本 | ✅ |
| `docs/事件題庫.md` | 去識別化的歷史事件題庫 | ✅ |
| `reference_md_deidentified/` | 187 份去識別化歷史新聞稿/速報（模型 grounding 素材） | ✅ |
| `prompts/` | Sonnet 撰稿、Opus 校正 prompt | ✅ |
| `cases/` | 回填的案例卡（去識別化） | ✅ |
| `web/` | 可勾選 HTML 介面 | ✅ |
| `doc/` | **原始文件（含個資）** | ❌ gitignore |

## 隱私守則（兩道防線）
1. 原始 `doc/` 不進 git。
2. 生成時不得將個資（手機/員編/姓名）寫入對外稿（見憲法條目六）。
> 注意：`reference_md_deidentified/` 已自動去識別化，但建議人工抽查後再 push 到遠端。
