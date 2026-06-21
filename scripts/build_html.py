# -*- coding: utf-8 -*-
"""
建置：把 knowledge_base.json 內嵌進 web/index.html 的 <script id="kb">，
輸出成 docs/index.html 供 GitHub Pages（來源設 /docs）服務。

來源檔： web/index.html  (編輯它，不要編輯 docs/index.html)
用法：   python scripts/build_html.py
"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
kb = (ROOT / "knowledge_base.json").read_text(encoding="utf-8")
json.loads(kb)  # 驗證 KB 為合法 JSON

pattern = re.compile(r'(<script[^>]*id="kb"[^>]*>)(.*?)(</script>)', re.S)
if not pattern.search(src):
    raise SystemExit('找不到 <script id="kb">，請確認 web/index.html 結構。')
out = pattern.sub(lambda m: m.group(1) + kb + m.group(3), src)

# 內嵌長官/民代名單（公開資料）
off_path = ROOT / "officials.json"
if off_path.exists():
    off = off_path.read_text(encoding="utf-8")
    json.loads(off)  # 驗證為合法 JSON
    opat = re.compile(r'(<script[^>]*id="officials"[^>]*>)(.*?)(</script>)', re.S)
    out = opat.sub(lambda m: m.group(1) + off + m.group(3), out)

# 內嵌語音/輸入預校正對照表
corr_path = ROOT / "corrections.json"
if corr_path.exists():
    corr = corr_path.read_text(encoding="utf-8")
    json.loads(corr)  # 驗證為合法 JSON
    cpat = re.compile(r'(<script[^>]*id="corrections"[^>]*>)(.*?)(</script>)', re.S)
    out = cpat.sub(lambda m: m.group(1) + corr + m.group(3), out)

# 注入稽核 rubric（Opus 撰寫，Sonnet 執行）
rubric_path = ROOT / "prompts" / "audit_rubric.md"
if rubric_path.exists():
    rubric = rubric_path.read_text(encoding="utf-8")
    rpat = re.compile(r'(<script[^>]*id="rubric"[^>]*>)(.*?)(</script>)', re.S)
    out = rpat.sub(lambda m: m.group(1) + rubric + m.group(3), out)

dst = ROOT / "docs" / "index.html"
dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(out, encoding="utf-8")
print(f"written docs/index.html ({len(out)} bytes), KB {len(kb)} bytes")
