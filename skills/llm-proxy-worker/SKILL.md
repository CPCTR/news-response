---
name: llm-proxy-worker
description: >
  用 Cloudflare Worker 當「持鑰的 LLM 代理」，讓純前端/靜態網站安全呼叫 LLM 而不把金鑰暴露在瀏覽器，
  並串多供應商 fallback 備援鏈（GitHub Models / OpenRouter / Anthropic / OpenAI 相容），任一掛了自動換下一個。
  當你要：前端/靜態頁面接 LLM 又不想暴露 API key、Cloudflare Worker 當 LLM gateway/proxy、
  多模型備援/fallback、免費額度 429 限流自動切換、瀏覽器零金鑰、換模型（gpt / gemini / claude / gpt-5-chat）、
  防端點被白嫖（x-app-key 共享密鑰、ALLOWED_ORIGIN 鎖來源、Cloudflare Access 登入閘）、
  把 Worker 掛同網域 /api（搭配 Pages）、或遇到 gpt-5/o 系列 max_completion_tokens、Access 把 XHR 導去登入頁
  導致 JSON 解析錯等問題時使用。
---

# LLM 代理 Worker（多供應商 fallback + 防白嫖 + Cloudflare Access）

## 何時用
任何「靜態前端（Pages/GitHub Pages）要呼叫 LLM」的情境。前端零金鑰，金鑰只在 Worker；多供應商輪替確保不因單一供應商限流/故障而斷稿；端點用 Access/密鑰鎖住只給授權者。

參考實作（可直接抄）：`news-response/worker/worker.js` + `worker/wrangler.toml`；同目錄 `worker.template.js` 為去專案化版本。

## 架構
```
瀏覽器(前端, 零金鑰) → Cloudflare Pages(靜態頁)
                         └ 同源 /api/generate → Worker(持鑰) → 供應商鏈：
                              OpenRouter → GitHub Models → Anthropic（依序，失敗換下一個）
   全站 response.example.com 套一道 Cloudflare Access（登入閘）→ 連 /api 都擋
```

## 核心：可擴充供應商鏈（worker.js 精華）
```js
const force = body.force;                       // 可選：強制只用某供應商，方便除錯
const chain = [
  { name:"openrouter", enabled:!!env.OPENROUTER_API_KEY, fn:callOpenRouter },
  { name:"github",     enabled:!!env.GITHUB_TOKEN,       fn:callGithub },
  { name:"anthropic",  enabled:!!env.ANTHROPIC_API_KEY,  fn:callAnthropic },
].filter(p => p.enabled && (!force || force===p.name));
if (!chain.length) return json({error:"no_backend_configured"}, 500, cors);
let lastDetail="";
for (const p of chain) {
  try { const r = await p.fn(env, system, user, maxTokens);
        if (r.ok) return json(r.payload, 200, cors);
        lastDetail = `${p.name}: ${r.detail}`;
  } catch(e){ lastDetail = `${p.name}: ${String(e)}`; }
}
return json({error:"all_backends_failed", detail:lastDetail}, 502, cors);
```
- GitHub Models / OpenRouter 都是 **OpenAI 相容**（同一個 callX 改 endpoint/key/model 即可）；Anthropic 用 `/v1/messages` + `x-api-key` + `anthropic-version`，回傳取 `content[].text`。
- 換模型＝改 `wrangler.toml` 的 `*_MODEL` 變數；換主路順序＝調 chain 陣列順序。

## 防白嫖三層（擇用）
1. **鎖來源** `ALLOWED_ORIGIN`（可逗號分隔多來源，含自訂網域 + pages.dev）；瀏覽器跨站會帶 Origin，不在清單就 403。**但 curl 不帶 Origin 可繞過 → 靠 2、3**。
2. **共享密鑰** `APP_KEY`：設了就比對 `x-app-key` 標頭，curl 也擋（401）。前端要帶同一把 key。**注意：若前端是公開頁面，把 key 寫進頁面＝洩漏**；只有當頁面本身被 Access 擋住才安全。
3. **Cloudflare Access（最強，推薦）**：在網域前面加登入閘（Cloudflare 帳號 / Google / email OTP），未登入連頁面和 /api 都進不來。**同網域**時一道 Access 全包，前端零金鑰、零 App Key。

## 部署步驟
```bash
cd worker && wrangler login                      # OAuth 每台機器各自登入
wrangler deploy                                  # 部署 Worker
echo "$KEY" | wrangler secret put GITHUB_TOKEN   # 金鑰用 secret，勿寫進程式/wrangler.toml
echo "$KEY" | wrangler secret put OPENROUTER_API_KEY
echo "$KEY" | wrangler secret put ANTHROPIC_API_KEY
# 靜態頁：wrangler pages deploy docs --project-name=<proj> --branch=main --commit-dirty=true
# 同網域 API：wrangler.toml 加 routes=[{pattern="response.example.com/api/*", zone_name="example.com"}]
# 鎖：Zero Trust → Access → Application(self-hosted, destination=response.example.com) + Policy(allow 你的 email/帳號)
```

## 踩過的坑（重要）
- **加 `routes` 後 wrangler 預設關掉 workers.dev**：會悄悄讓舊 workers.dev 網址失效。過渡期顯式 `workers_dev = true` 並存，切換完成再改 `false` 正式關後門。
- **route `/api/*` 不匹配裸 `/api`**：前端打 `/api`（無結尾）會落到 Pages → POST 回 **405**。解法：前端打 `/api/generate`（或 route 用 `/api*`）。
- **Cloudflare Access 對 XHR/fetch 未登入 → 302 轉登入頁(HTML)**：前端 `.json()` 爆 `Unexpected end of JSON input`。**同網域**且已登入時，fetch 預設帶 cookie → Access 放行；確認使用者真的登入了該分頁。Access 設計給「頁面導航」，背景 API 要同源才順。
- **gpt-5 / o3 / o4 等推理模型拒收 `max_tokens`**，要 `max_completion_tokens`；`gpt-5-chat`、`gpt-4*` 用 `max_tokens`。可依 model 字串自動挑：`/gpt-5|o3|o4/.test(model) && !/chat/.test(model)`。
- **免費供應商有速率限制**（GitHub Models 反覆測試會 429）→ 這就是要備援鏈的原因；正式環境至少設一個付費 fallback。
- **金鑰別 echo 進終端機/貼聊天**（會留 scrollback、被擋）：用 `wrangler secret put`（隱藏輸入）或編輯 gitignored `worker/.dev.vars`。曝光過就 revoke 重發。
- **`wrangler secret put` 後**會觸發新版本，**等幾秒**再測（剛設可能還回舊行為）。
- **本機 dev**：`wrangler dev --local` 讀 `worker/.dev.vars`（gitignored）的 secret 與 vars（可在此覆蓋 `ALLOWED_ORIGIN=http://localhost:8788` 解本機 CORS）；`.dev.vars` 是**啟動時**載入，改了要重啟。
- **自訂網域**：Pages custom domain 應自動建 CNAME；若沒建就手動建 `CNAME 子網域→<proj>.pages.dev（Proxied）`。DNS 傳播 + Edge SSL 簽發要等幾~十幾分鐘（其間 HTTP 000 正常）。
- **瀏覽器快取舊頁面**：部署後看到舊行為先硬重整（Cmd+Shift+R）；本機開發可用 no-cache 靜態伺服器。

## 環境變數
- secrets（`wrangler secret put`）：`GITHUB_TOKEN`(models:read) / `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` / `APP_KEY`(選用)
- vars（wrangler.toml `[vars]`）：`ALLOWED_ORIGIN`（可多來源逗號分隔）/ `GH_MODEL` / `OPENROUTER_MODEL` / `ANTHROPIC_MODEL`
