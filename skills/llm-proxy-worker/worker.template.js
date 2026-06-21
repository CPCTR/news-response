/**
 * 新聞稿助理 — LLM 代理 (Cloudflare Worker)
 *
 * 為什麼需要它：GitHub Pages 是純靜態，無法安全保管金鑰。
 * 這支 Worker 是「持鑰的代理」：前端只打這個 endpoint，金鑰留在 Worker。
 *
 * 路由策略：供應商鏈，依序嘗試，前一個失敗（429/403/5xx）就換下一個：
 *   1) GitHub Models（免費額度，主路）
 *   2) OpenRouter（備援）
 *   3) Anthropic（備援）
 *
 * 前端送來的 body： { system, user, max_tokens?, force? }
 *   force: "github" | "openrouter" | "anthropic"  // 可選，強制只用單一供應商，方便除錯
 * 回傳： { text, provider, model }
 *
 * 需要的環境變數（金鑰用 `wrangler secret put`，不要寫在程式碼）：
 *   GITHUB_TOKEN        — GitHub PAT，需 models:read 權限（主路）
 *   OPENROUTER_API_KEY  — OpenRouter 金鑰（備援，可省略）
 *   ANTHROPIC_API_KEY   — Anthropic 金鑰（備援，可省略）
 * 一般變數（可寫在 wrangler.toml [vars]）：
 *   ALLOWED_ORIGIN      — 你的頁面網域（可逗號分隔多個）
 *   GH_MODEL            — GitHub Models 模型 id，例如 openai/gpt-5-chat
 *   OPENROUTER_MODEL    — OpenRouter 模型 id，例如 openai/gpt-4o-mini
 *   ANTHROPIC_MODEL     — Anthropic 模型 id，例如 claude-sonnet-4-6
 */

const GH_ENDPOINT = "https://models.github.ai/inference/chat/completions";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";

export default {
  async fetch(request, env) {
    // ALLOWED_ORIGIN 可逗號分隔多個來源（如 自訂網域 + pages.dev）；"*" 為全放行
    const reqOrigin = request.headers.get("Origin") || "";
    const allowList = (env.ALLOWED_ORIGIN || "*").split(",").map(s => s.trim()).filter(Boolean);
    const allowAll = allowList.includes("*");
    const corsOrigin = allowAll ? "*" : (allowList.includes(reqOrigin) ? reqOrigin : (allowList[0] || "*"));
    const cors = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, x-app-key",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST")
      return json({ error: "POST only" }, 405, cors);

    // 防白嫖①：鎖來源。瀏覽器跨站請求會帶 Origin；不在允許清單就擋（非瀏覽器無 Origin 則放行，靠 ②）。
    if (!allowAll && reqOrigin && !allowList.includes(reqOrigin))
      return json({ error: "forbidden_origin" }, 403, cors);
    // 防白嫖②：共享密鑰。設了 APP_KEY 就強制比對 x-app-key（curl 等非瀏覽器也擋）。
    // 正式環境務必 `wrangler secret put APP_KEY`；本機不設則開放，方便測試。
    if (env.APP_KEY && request.headers.get("x-app-key") !== env.APP_KEY)
      return json({ error: "unauthorized" }, 401, cors);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid JSON" }, 400, cors);
    }

    const system = (body.system || "").toString();
    const user = (body.user || "").toString();
    const maxTokens = Math.min(Number(body.max_tokens) || 2500, 4000);
    if (!user) return json({ error: "missing user prompt" }, 400, cors);

    const force = body.force; // 可選："github" | "openrouter" | "anthropic"
    // 供應商鏈：依序嘗試，前一個失敗就換下一個；force 指定則只跑那一個
    const chain = [
      { name: "openrouter", enabled: !!env.OPENROUTER_API_KEY, fn: callOpenRouter },
      { name: "github",     enabled: !!env.GITHUB_TOKEN,       fn: callGithub },
      { name: "anthropic",  enabled: !!env.ANTHROPIC_API_KEY,  fn: callAnthropic },
    ].filter((p) => p.enabled && (!force || force === p.name));

    if (!chain.length) return json({ error: "no_backend_configured" }, 500, cors);

    let lastDetail = "";
    for (const p of chain) {
      try {
        const r = await p.fn(env, system, user, maxTokens);
        if (r.ok) return json(r.payload, 200, cors);
        lastDetail = `${p.name}: ${r.detail}`;
      } catch (e) {
        lastDetail = `${p.name}: ${String(e)}`;
      }
    }
    return json({ error: "all_backends_failed", detail: lastDetail }, 502, cors);
  },
};

async function callGithub(env, system, user, maxTokens) {
  const model = env.GH_MODEL || "openai/gpt-4o";
  const res = await fetch(GH_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    },
    body: JSON.stringify({
      model,
      // gpt-5 / o3 / o4 等推理模型只接受 max_completion_tokens；gpt-4*、gpt-5-chat 用 max_tokens
      [/gpt-5|o3|o4/.test(model) && !/chat/.test(model) ? "max_completion_tokens" : "max_tokens"]: maxTokens,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    return { ok: false, detail: `GH ${res.status}: ${(await res.text()).slice(0, 300)}` };
  }
  const j = await res.json();
  const text = j.choices?.[0]?.message?.content || "";
  return { ok: true, payload: { text, provider: "github_models", model } };
}

async function callOpenRouter(env, system, user, maxTokens) {
  const model = env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "X-Title": "news-response",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    return { ok: false, detail: `OR ${res.status}: ${(await res.text()).slice(0, 300)}` };
  }
  const j = await res.json();
  const text = j.choices?.[0]?.message?.content || "";
  return { ok: true, payload: { text, provider: "openrouter", model } };
}

async function callAnthropic(env, system, user, maxTokens) {
  const model = env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const res = await fetch(ANTHROPIC_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    return { ok: false, detail: `ANT ${res.status}: ${(await res.text()).slice(0, 300)}` };
  }
  const j = await res.json();
  const text = (j.content || []).map((c) => c.text || "").join("");
  return { ok: true, payload: { text, provider: "anthropic", model } };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}
