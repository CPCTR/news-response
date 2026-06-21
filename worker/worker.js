/**
 * 新聞稿助理 — LLM 代理 (Cloudflare Worker)
 *
 * 為什麼需要它：GitHub Pages 是純靜態，無法安全保管金鑰。
 * 這支 Worker 是「持鑰的代理」：前端只打這個 endpoint，金鑰留在 Worker。
 *
 * 路由策略（符合你的選擇：GitHub Models 免費為主，Cloudflare 為載體）：
 *   1) 預設打 GitHub Models（免費額度）
 *   2) 遇到 429 / 403 / 5xx（多半是每日額度用盡）→ 自動 fallback 到 Anthropic
 *
 * 前端送來的 body： { system, user, max_tokens?, force? }
 *   force: "github" | "anthropic"  // 可選，強制指定供應商，方便除錯
 * 回傳： { text, provider, model }
 *
 * 需要的環境變數（用 `wrangler secret put` 設定，不要寫在程式碼）：
 *   GITHUB_TOKEN        — GitHub PAT，需 models:read 權限（主路）
 *   ANTHROPIC_API_KEY   — Anthropic 金鑰（備援，可省略）
 * 一般變數（可寫在 wrangler.toml [vars]）：
 *   ALLOWED_ORIGIN      — 你的 Pages 網域，例如 https://news-response.launchdock.app
 *   GH_MODEL            — GitHub Models 模型 id，例如 openai/gpt-4o
 *   ANTHROPIC_MODEL     — 備援模型，例如 claude-sonnet-4-6
 */

const GH_ENDPOINT = "https://models.github.ai/inference/chat/completions";
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

    const force = body.force; // optional
    const tryGithub = force !== "anthropic" && !!env.GITHUB_TOKEN;
    const tryAnthropic = force !== "github" && !!env.ANTHROPIC_API_KEY;

    // 1) 主路：GitHub Models
    if (tryGithub) {
      try {
        const r = await callGithub(env, system, user, maxTokens);
        if (r.ok) return json(r.payload, 200, cors);
        // 額度 / 暫時性錯誤 → 嘗試 fallback
        if (!tryAnthropic) return json({ error: "github_models_failed", detail: r.detail }, 502, cors);
      } catch (e) {
        if (!tryAnthropic) return json({ error: "github_models_error", detail: String(e) }, 502, cors);
      }
    }

    // 2) 備援：Anthropic
    if (tryAnthropic) {
      try {
        const r = await callAnthropic(env, system, user, maxTokens);
        if (r.ok) return json(r.payload, 200, cors);
        return json({ error: "anthropic_failed", detail: r.detail }, 502, cors);
      } catch (e) {
        return json({ error: "anthropic_error", detail: String(e) }, 502, cors);
      }
    }

    return json({ error: "no_backend_configured" }, 500, cors);
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
