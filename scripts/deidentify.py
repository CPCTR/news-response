#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
去識別化清掃 — reference_md_deidentified/ 上線（push）前的安全閘。

設計原則（見 MODELS.md）：
- 確定性的（信箱/手機/員編/「X君」）用規則直接遮蔽，免 LLM、零風險。
- 判斷性的（正文殘留真實姓名）交給人工複核，或 --llm 用 Opus 找出建議遮蔽清單。
- 預設 dry-run：只報告、不改檔。確認後加 --apply 才寫入。

用法：
  python scripts/deidentify.py                 # 掃描並產報告（不改檔）
  python scripts/deidentify.py --apply         # 套用規則層遮蔽
  python scripts/deidentify.py --llm           # 另用 Opus 找殘留姓名（需 ANTHROPIC_API_KEY）
  python scripts/deidentify.py --llm --apply   # 一併套用 LLM 建議

公開資訊（不遮蔽）：總機 03-3255111、客服 1912、單位名稱、職稱。
"""
import os, re, sys, json, pathlib, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "reference_md_deidentified"
REPORT = ROOT / "scripts" / "extract"; REPORT.mkdir(parents=True, exist_ok=True)
APPLY = "--apply" in sys.argv
USE_LLM = "--llm" in sys.argv

# 已知姓名→替代。**名單本身含人名，故存於本機 gitignored 檔，不入版控/歷史。**
# 維護：scripts/name_map.local.json（鍵=原文字串、值=替換字串；逐行替換，
# 「複合/拆字形」鍵須排在「短姓+職稱」鍵之前）。檔不存在則退回空 map（僅跑規則層）。
_NAME_MAP_FILE = ROOT / "scripts" / "name_map.local.json"
NAME_MAP = json.loads(_NAME_MAP_FILE.read_text(encoding="utf-8")) if _NAME_MAP_FILE.exists() else {}

# 確定性規則
RULES = [
    ("cpc個人信箱", re.compile(r'[0-9]{6}@cpc\.com\.tw'), "○○○@cpc.com.tw"),
    ("手機",        re.compile(r'09\d{2}[-\s]?\d{3}[-\s]?\d{3}'), "（手機已遮蔽）"),
    ("員編",        re.compile(r'員編\s*[:：]?\s*\d+'), "員編○○○"),
    # 市話但排除公開總機 3255111
    ("非總機市話",  re.compile(r'\(0\d\)\s?(?!3255111)\d{6,8}|0\d-(?!3255111)\d{6,8}'), "（電話已遮蔽）"),
    # 「朱君」「王君」等：保留「君」去掉姓
    ("姓+君",       re.compile(r'(?<![A-Za-z0-9])[一-鿿]君(?=[，。、）\s]|$)'), "某君"),
]

HEADER = "去識別化轉檔"  # 檔頭註解行，內含「員編」等字，掃描時略過該行

def scan_file(text):
    hits = {}
    out_lines = []
    for line in text.splitlines(keepends=True):
        if HEADER in line:               # 略過檔頭註解
            out_lines.append(line); continue
        for name, repl in NAME_MAP.items():
            if name in line:
                hits.setdefault("已知姓名", 0)
                hits["已知姓名"] += line.count(name)
                line = line.replace(name, repl)
        for label, rx, repl in RULES:
            n = len(rx.findall(line))
            if n:
                hits[label] = hits.get(label, 0) + n
                line = rx.sub(repl, line)
        out_lines.append(line)
    return "".join(out_lines), hits

# 啟發式：標出疑似殘留姓名（職銜/稱謂相鄰的中文名），供人工或 LLM 複核
SUSPECT = re.compile(r'[一-鿿]{2,3}(?=(?:先生|小姐|女士|君|廠長|副廠長|課長|組長|經理|里長|委員|議員|代表|律師))'
                     r'|(?:廠長|副廠長|課長|里長|委員|經理)[一-鿿]{2,3}')

def suspects(text):
    s = set()
    for line in text.splitlines():
        if HEADER in line: continue
        for m in SUSPECT.findall(line):
            if m: s.add(m)
    return sorted(s)

def llm_names(text):
    """用 Opus 找出正文中應遮蔽的真實個人姓名，回傳 list。"""
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key: return []
    sysmsg = ("你是去識別化稽核員。從以下新聞稿正文找出所有『真實個人姓名』（不含職稱、單位、公眾人物職銜）。"
              "只輸出 JSON 陣列字串，如 [\"某甲\",\"某乙\"]，沒有則輸出 []。")
    req = urllib.request.Request("https://api.anthropic.com/v1/messages",
        data=json.dumps({"model": os.environ.get("ANTHROPIC_MODEL","claude-opus-4-8"),
            "max_tokens": 400, "system": sysmsg,
            "messages": [{"role":"user","content": text[:4000]}]}).encode(),
        headers={"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            j = json.loads(r.read().decode())
        txt = "".join(c.get("text","") for c in j["content"])
        m = re.search(r'\[.*\]', txt, re.S)
        return json.loads(m.group(0)) if m else []
    except Exception as e:
        print("  LLM 失敗：", e); return []

def main():
    report = []
    for f in sorted(SRC.glob("*.md")):
        text = f.read_text(encoding="utf-8")
        new, hits = scan_file(text)
        susp = suspects(text)
        llm_found = llm_names(text) if (USE_LLM and susp) else []
        for nm in llm_found:                 # 把 LLM 找到的名字也遮蔽
            if nm and nm in new:
                new = new.replace(nm, "○○○"); hits["LLM姓名"] = hits.get("LLM姓名",0)+1
        if hits or susp:
            report.append({"file": f.name, "masked": hits,
                           "suspect_names": susp, "llm_names": llm_found})
        if APPLY and new != text:
            f.write_text(new, encoding="utf-8")
    (REPORT / "deid_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    n_masked = sum(1 for r in report if r["masked"])
    n_susp = sum(1 for r in report if r["suspect_names"])
    print(f"掃描 {len(list(SRC.glob('*.md')))} 檔。")
    print(f"  規則層命中（信箱/電話/員編/X君）：{n_masked} 檔")
    print(f"  疑似殘留姓名待複核：{n_susp} 檔  → 報告：scripts/extract/deid_report.json")
    print(("已套用遮蔽（--apply）。" if APPLY else "目前為 dry-run，未改檔；確認報告後加 --apply。"))
    if n_susp and not USE_LLM:
        print("  建議：複核報告中的 suspect_names 填入 NAME_MAP，或用 --llm 讓 Opus 自動找名字。")

if __name__ == "__main__":
    main()
