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
 *   SUPABASE_SERVICE_KEY— Supabase service_role 金鑰（身份閘查 cpc_identities 用；務必 secret put，勿明文）
 * 一般變數（可寫在 wrangler.toml [vars]）：
 *   ALLOWED_ORIGIN      — 你的頁面網域（可逗號分隔多個）
 *   SUPABASE_URL        — Supabase 專案 URL（身份閘驗證用）
 *   SUPABASE_ANON_KEY   — Supabase publishable/anon key（驗證 /auth/v1/user 用）
 *   GMAIL_ALLOWLIST     — 授權 Gmail 白名單（逗號分隔）
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
      "Access-Control-Allow-Headers": "content-type, x-app-key, authorization",
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

    // 防白嫖③：Supabase 身份閘。只有「LINE 白名單帳號」或「授權 Gmail」能生稿，
    // 其他人一律擋在呼叫 LLM 之前（fail-closed，驗證失敗絕不燒 LLM 費用）。
    const gate = await authGate(request, env);
    if (!gate.ok) return json({ error: gate.error }, gate.status, cors);

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

/**
 * Supabase 身份閘：驗證呼叫者是否為授權使用者。
 * 回傳 { ok:true }（放行）或 { ok:false, status, error }（擋下，附 HTTP 狀態碼與錯誤碼）。
 *
 * 放行條件（擇一）：
 *   A) Google 登入且 email ∈ GMAIL_ALLOWLIST（逗號分隔，比對前 lowercase+trim）。
 *   B) LINE 登入且該 line_uid 存在於 cpc_identities 表。
 * 任何一步失敗（無 token / session 無效 / 不在白名單）都不放行，且不會呼叫 LLM。
 *
 * 容錯：Supabase 回傳的 user JSON 結構未必固定，取欄位一律用 ?. 與 fallback 防呆。
 */
async function authGate(request, env) {
  // 1) 取 Bearer token；沒有就直接擋（fail-closed）
  const authHeader = request.headers.get("Authorization") || request.headers.get("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : "";
  if (!token) return { ok: false, status: 401, error: "login_required" };

  // 設定不齊全時保守擋下（避免誤放行）
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { ok: false, status: 401, error: "invalid_session" };
  }

  // 2) 用 token 換 user，驗證 session 是否有效
  let user;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });
    if (res.status !== 200) return { ok: false, status: 401, error: "invalid_session" };
    user = await res.json();
  } catch {
    return { ok: false, status: 401, error: "invalid_session" };
  }
  if (!user || typeof user !== "object") {
    return { ok: false, status: 401, error: "invalid_session" };
  }

  const identities = Array.isArray(user.identities) ? user.identities : [];
  const providers = new Set();
  // app_metadata.provider（主要）與 app_metadata.providers[]（多重綁定時）
  if (user.app_metadata?.provider) providers.add(String(user.app_metadata.provider).toLowerCase());
  for (const p of (user.app_metadata?.providers || [])) providers.add(String(p).toLowerCase());
  // 逐筆 identity 的 provider 也納入判斷
  for (const idn of identities) {
    if (idn?.provider) providers.add(String(idn.provider).toLowerCase());
  }

  // 3a) Google：email 在允許清單即放行
  const hasGoogle = providers.has("google");
  if (hasGoogle) {
    const email = (user.email || "").toString().trim().toLowerCase();
    const allow = (env.GMAIL_ALLOWLIST || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (email && allow.includes(email)) return { ok: true };
    // Google 但不在白名單 → 繼續往下（理論上不會又是 LINE，最終落到 not_whitelisted）
  }

  // 3b) LINE：custom OIDC，identities[].provider 可能是 'line'
  const hasLine =
    providers.has("line") ||
    identities.some((idn) => /line/i.test(String(idn?.provider || "")));
  if (hasLine) {
    // 取 line_uid：優先該筆 identity 的 id，退而求其次 user_metadata 的 sub / provider_id
    let lineUid = "";
    const lineIdn = identities.find((idn) => /line/i.test(String(idn?.provider || "")));
    lineUid =
      (lineIdn?.id || "").toString().trim() ||
      (user.user_metadata?.sub || "").toString().trim() ||
      (user.user_metadata?.provider_id || "").toString().trim();
    // 合理性檢查：LINE userId 應為 U + 32 hex（格式不符仍嘗試查，避免因格式判斷失誤而誤擋）
    if (lineUid) {
      try {
        const uidEnc = encodeURIComponent(lineUid);
        const res = await fetch(
          `${env.SUPABASE_URL}/rest/v1/cpc_identities?line_uid=eq.${uidEnc}&select=line_uid`,
          {
            headers: {
              apikey: env.SUPABASE_SERVICE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            },
          }
        );
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length >= 1) return { ok: true };
        }
      } catch {
        // 查詢失敗保守擋下
      }
    }
  }

  // 4) 都不符 → 擋下
  return { ok: false, status: 401, error: "not_whitelisted" };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}
