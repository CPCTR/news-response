# MODELS.md — 模型分工

決策軸：**頻率 × 風險 × 錯誤是否複利**，不是「生成 vs 資料庫」。
核心理由：一份爛草稿人工核稿就擋掉，損害止於當下；一條爛知識點進庫會**污染之後每一次生成**（複利放大）。
所以智力要花在「錯誤會持續累積」的環節 —— 知識庫策展。

| 環節 | 模型 | 型號 | 頻率/風險 | 為何 |
|---|---|---|---|---|
| 訂規則 / 稽核 rubric / 版型 | **Opus** | `claude-opus-4-8` | 極低頻、高槓桿 | 一次性把判斷沉澱成可重複的工件 |
| **知識庫抽取與策展**（案例卡、寫作手法、去重、防殘留個資） | **Opus** | `claude-opus-4-8` | 低頻、非同步、錯誤複利 | 投資報酬最高處 |
| 生成草稿（初稿/正式版/局部重寫） | **Sonnet** | `claude-sonnet-4-6` | 高頻、有風險 | 受憲法/版型/檢索約束的有界任務 |
| 合規稽核（套用 Opus 的 rubric） | **Sonnet** | `claude-sonnet-4-6` | 高頻、**高風險** | 危機公關最貴的一次失誤在此；**先別降到 Haiku** |
| 事件分類 / 打標籤 / 術語修正 / PII 預掃 / 組檢索 query | **Haiku** | `claude-haiku-4-5-20251001` | 高頻、機械 | 純執行，最便宜 |

## 落地對照
- **Worker（互動生成）**：`ANTHROPIC_MODEL=claude-sonnet-4-6`（備援）；主路 GitHub Models 用中階模型即可。
- **`learn-from-pr.yml` + `extract_case_card.py`（KB 策展）**：用 **Opus**（`ANTHROPIC_API_KEY`）。非同步、量少，成本與延遲無所謂。
- **`generate_draft.py`（Issue 生稿）**：Sonnet。
- **前端 `audit()`**：套用 `prompts/audit_rubric.md`（Opus 撰寫），執行用 Sonnet。

## 一條紀律
合規稽核要降到更便宜的模型前，**必須先有一組「已知地雷草稿」eval** 證明它接得住（未認責、未臆測、無法律自認、無個資）。沒有 eval，就維持 Sonnet。
