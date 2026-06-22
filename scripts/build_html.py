# -*- coding: utf-8 -*-
"""
建置：把單位資料內嵌進 web/index.html 的各 <script> 注入點，輸出可部署的 index.html。

來源檔： web/index.html  (編輯它，不要編輯 docs/index.html)

兩種模式：
  1) 預設（桃園煉油廠，根目錄檔）：
       python scripts/build_html.py
     讀 ./knowledge_base.json / officials.json / corrections.json（OPTIONS 用 HTML 內建 fallback），
     輸出 docs/index.html。

  2) 多單位（unit pack）：
       python scripts/build_html.py --unit <key>
     讀 units/<key>/{options,knowledge_base,officials,corrections}.json，
     輸出 docs/<key>/index.html。缺哪一檔就跳過該注入（用 HTML 預設）。

注入點（<script id=...>）：kb / options / officials / corrections / rubric。
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def inject(html, script_id, json_text):
    """把 json_text 塞進 <script id="script_id">…</script>，回傳新 html。找不到注入點則報錯。"""
    json.loads(json_text)  # 驗證合法 JSON
    pat = re.compile(r'(<script[^>]*id="%s"[^>]*>)(.*?)(</script>)' % re.escape(script_id), re.S)
    if not pat.search(html):
        raise SystemExit(f'找不到 <script id="{script_id}">，請確認 web/index.html 結構。')
    # 只替換第一個（真正的）注入點；避免註解或字串中出現同名 id 字樣被誤匹配而吃掉後續內容。
    return pat.sub(lambda m: m.group(1) + json_text + m.group(3), html, count=1)


def parse_args(argv):
    unit = None
    for i, a in enumerate(argv):
        if a == "--unit" and i + 1 < len(argv):
            unit = argv[i + 1]
        elif a.startswith("--unit="):
            unit = a.split("=", 1)[1]
    return unit


def main():
    unit = parse_args(sys.argv[1:])
    src = (ROOT / "web" / "index.html").read_text(encoding="utf-8")

    if unit:
        base = ROOT / "units" / unit
        if not base.is_dir():
            raise SystemExit(f"找不到單位資料夾：units/{unit}/")
        # (script_id, 檔名, 是否必須)
        files = [
            ("kb", "knowledge_base.json", True),
            ("options", "options.json", True),
            ("profile", "unit_profile.json", False),
            ("officials", "officials.json", False),
            ("corrections", "corrections.json", False),
        ]
        injected = []
        for sid, fname, required in files:
            p = base / fname
            if p.exists():
                src = inject(src, sid, p.read_text(encoding="utf-8"))
                injected.append(fname)
            elif required:
                raise SystemExit(f"units/{unit}/ 缺少必要檔案：{fname}")
        dst = ROOT / "docs" / unit / "index.html"
        label = f"unit={unit} [{', '.join(injected)}]"
    else:
        # 預設：桃園煉油廠，讀根目錄檔（OPTIONS 用 HTML 內建 fallback，不注入）
        src = inject(src, "kb", (ROOT / "knowledge_base.json").read_text(encoding="utf-8"))
        for sid, fname in [("officials", "officials.json"), ("corrections", "corrections.json")]:
            p = ROOT / fname
            if p.exists():
                src = inject(src, sid, p.read_text(encoding="utf-8"))
        dst = ROOT / "docs" / "index.html"
        label = "default (桃園煉油廠)"

    # 注入稽核 rubric（Opus 撰寫，Sonnet 執行）— 兩種模式共用
    rubric_path = ROOT / "prompts" / "audit_rubric.md"
    if rubric_path.exists():
        rubric = rubric_path.read_text(encoding="utf-8")
        rpat = re.compile(r'(<script[^>]*id="rubric"[^>]*>)(.*?)(</script>)', re.S)
        src = rpat.sub(lambda m: m.group(1) + rubric + m.group(3), src)

    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(src, encoding="utf-8")
    rel = dst.relative_to(ROOT)
    print(f"written {rel} ({len(src)} bytes) — {label}")


if __name__ == "__main__":
    main()
