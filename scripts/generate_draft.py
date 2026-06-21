#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
依事件事實生成新聞稿初稿（GitHub Models）。

輸入（擇一）：
  - 環境變數 EVENT_TEXT：事件事實 / 速報內容
  - 命令列參數：python scripts/generate_draft.py "事件描述..."
輸出：drafts/draft-<timestamp>.md
"""
import json, os, sys, urllib.request, pathlib, datetime, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENDPOINT = "https://models.github.ai/inference/chat/completions"
MODEL = os.environ.get("GH_MODEL", "openai/gpt-4o")
TOKEN = os.environ.get("GITHUB_TOKEN", "")


def read(p, default=""):
    f = ROOT / p
    return f.read_text(encoding="utf-8") if f.exists() else default


def call_github(system, user, max_tokens=2800):
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps({
            "model": MODEL,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }).encode("utf-8"),
        headers={"content-type": "application/json", "Authorization": f"Bearer {TOKEN}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        j = json.loads(resp.read().decode("utf-8"))
    return j["choices"][0]["message"]["content"]


def main():
    event = os.environ.get("EVENT_TEXT", "").strip() or " ".join(sys.argv[1:]).strip()
    if not event:
        sys.exit("缺少事件內容（EVENT_TEXT 或命令列參數）。")
    if not TOKEN:
        sys.exit("缺少 GITHUB_TOKEN（Actions 需加 permissions: models: read）。")

    constitution = read("CONSTITUTION.md")
    kb = read("knowledge_base.json")

    system = (
        "你是台灣中油桃園煉油廠的新聞稿撰稿助理。嚴格遵守《憲法》全文，"
        "並參考知識庫的官方版型、回應原則與 few-shot 語氣。"
        "每個關鍵事實後標 (來源:使用者輸入)；無來源者標 [待確認]，禁止虛構；不得寫入個資。"
        "全文標示『草稿，待人工核准』。\n\n【憲法】\n" + constitution
        + "\n\n【知識庫】\n" + kb
    )
    user = (
        "【事件事實】\n" + event
        + "\n\n【任務】先判定事件分類與嚴重度、是否需對外，再產出三版本，"
        "以 Markdown『## 版本名』分隔：快速澄清版、正式新聞稿版、內部通報版。"
    )

    out_text = call_github(system, user)
    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    out = ROOT / "drafts" / f"draft-{ts}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    header = f"# 新聞稿初稿（草稿，待人工核准）\n\n> 生成時間：{ts}　模型：{MODEL}\n\n## 事件輸入\n\n{event}\n\n---\n\n"
    out.write_text(header + out_text, encoding="utf-8")
    print(f"✓ 已生成 drafts/{out.name}")
    # 供 workflow 取檔名
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a") as f:
            f.write(f"draft_path=drafts/{out.name}\n")


if __name__ == "__main__":
    main()
