#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
從去識別化新聞稿 .md 抽取「結構化案例卡」(= 你框架裡的 RAG 知識點)。

用法：
  python scripts/extract_case_card.py path/to/a.md path/to/b.md
  # 或設環境變數 CHANGED_FILES（換行或空白分隔）

輸出：每篇 → cases/<case_id>.json
LLM：GitHub Models（OpenAI 相容），讀環境變數 GITHUB_TOKEN（Actions 內建即可，
     workflow 需加 `permissions: models: read`）。模型用 GH_MODEL，預設 openai/gpt-4o。
"""
import json, os, re, sys, urllib.request, urllib.error, pathlib, hashlib, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
# KB 策展是「錯誤會複利」的環節 → 預設用最聰明的 Opus（見 MODELS.md）。
# 有 ANTHROPIC_API_KEY 走 Opus；否則退回 GitHub Models。
GH_ENDPOINT = "https://models.github.ai/inference/chat/completions"
GH_MODEL = os.environ.get("GH_MODEL", "openai/gpt-4o")
GH_TOKEN = os.environ.get("GITHUB_TOKEN", "")
ANT_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANT_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8")
USE_ANTHROPIC = bool(ANT_KEY)
MODEL = ANT_MODEL if USE_ANTHROPIC else GH_MODEL

SCHEMA_HINT = {
    "case_id": "PR-YYYYMMDD-NNN",
    "date": "YYYY-MM-DD 或 民國年轉西元",
    "event_type": "火災|氣體外洩|工安傷亡|異味投訴|環保超標|歲修排放|管線洩漏|跳電停爐|勞資工會|陳抗|不實訊息|官員視察|睦鄰公益|媒體回應|其他",
    "severity": "低|中|高|重大",
    "is_public": "true=對外發稿 / false=僅內部通報",
    "equipment": ["相關設備/工場（去識別化）"],
    "authorities": ["提及之主管機關"],
    "key_messages": ["這篇新聞稿的核心訊息句（拆成知識點）"],
    "tone_tags": ["語氣標籤，如 嚴肅/負責/安撫/澄清"],
    "opening_pattern": "起手式（如『有關媒體報導…說明如下』）",
    "closing_pattern": "結語型態（如『持續加強工安環保、做好鄰居』）",
    "writing_moves": ["寫作手法知識點：標題如何把結論寫進去、如何回應爭點、如何標待確認等"],
    "source_file": "來源檔名",
}


def constitution():
    p = ROOT / "CONSTITUTION.md"
    return p.read_text(encoding="utf-8") if p.exists() else ""


def call_llm(system, user, max_tokens=1800):
    if USE_ANTHROPIC:
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps({
                "model": ANT_MODEL, "max_tokens": max_tokens, "system": system,
                "messages": [{"role": "user", "content": user}],
            }).encode("utf-8"),
            headers={"content-type": "application/json", "x-api-key": ANT_KEY,
                     "anthropic-version": "2023-06-01"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=180) as resp:
            j = json.loads(resp.read().decode("utf-8"))
        return "".join(c.get("text", "") for c in j["content"])
    # 退回 GitHub Models
    req = urllib.request.Request(
        GH_ENDPOINT,
        data=json.dumps({
            "model": GH_MODEL, "max_tokens": max_tokens,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }).encode("utf-8"),
        headers={"content-type": "application/json", "Authorization": f"Bearer {GH_TOKEN}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        j = json.loads(resp.read().decode("utf-8"))
    return j["choices"][0]["message"]["content"]


def extract_json(text):
    """從模型輸出中擷取第一個 JSON 物件。"""
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("no JSON in model output:\n" + text[:400])
    return json.loads(m.group(0))


def make_case_id(content, date):
    h = hashlib.sha1(content.encode("utf-8")).hexdigest()[:3].upper()
    d = re.sub(r"[^0-9]", "", date)[:8] or datetime.date.today().strftime("%Y%m%d")
    return f"PR-{d}-{h}"


def process(path):
    text = pathlib.Path(path).read_text(encoding="utf-8")
    system = (
        "你是新聞稿分析器。嚴格遵守附上的《憲法》。"
        "請把這篇台灣中油桃園煉油廠的去識別化新聞稿，拆解成一張結構化『案例卡』(RAG 知識點)。"
        "只輸出 JSON，欄位與型別嚴格依照範本，不要多餘文字。"
        "若某欄無法判定填 null 或空陣列。不得寫入任何個資。\n\n【憲法】\n" + constitution()
    )
    user = (
        "【案例卡 JSON 範本】\n" + json.dumps(SCHEMA_HINT, ensure_ascii=False, indent=2)
        + "\n\n【待分析新聞稿】\n" + text
    )
    raw = call_llm(system, user)
    card = extract_json(raw)
    card["source_file"] = os.path.basename(path)
    if not card.get("case_id"):
        card["case_id"] = make_case_id(text, str(card.get("date", "")))
    out = ROOT / "cases" / f"{card['case_id']}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  ✓ {path} → cases/{out.name}")
    return card


def main():
    files = sys.argv[1:]
    if not files:
        files = re.split(r"\s+", os.environ.get("CHANGED_FILES", "").strip())
    files = [f for f in files if f and f.endswith(".md")]
    if not files:
        print("沒有要處理的 .md 檔。")
        return
    if not (ANT_KEY or GH_TOKEN):
        sys.exit("缺少模型憑證：設 ANTHROPIC_API_KEY（建議，走 Opus）或 GITHUB_TOKEN（需 models:read）。")
    print(f"分析 {len(files)} 篇新聞稿，模型 = {MODEL}（{'Anthropic' if USE_ANTHROPIC else 'GitHub Models'}）")
    for f in files:
        try:
            process(f)
        except Exception as e:
            print(f"  ✗ {f}: {e}")


if __name__ == "__main__":
    main()
