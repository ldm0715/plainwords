// Vercel Edge Function: /api/llm/* → forwards to the Zhipu (GLM) endpoint.
// Injects the server-side key from the ZHIPU_API_KEY environment variable —
// the browser never sees a key in production. Optional BYOK: a client may
// send its own `x-api-key` header (set via the in-app Settings dialog), which
// takes precedence over the server key.

// Bare Vercel Functions (non-Next.js) opt into the edge runtime with a
// `config` export; `export const runtime` is a Next.js-only convention.
export const config = { runtime: "edge" }

const UPSTREAM = "https://open.bigmodel.cn/api/coding/paas/v4"

export default async function handler(req: Request): Promise<Response> {
  // POST = chat/completions; GET = /models listing. Both forward as-is.
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Vercel maps this file to exactly /api/llm; vercel.json rewrites the
  // subpaths here. Recover the upstream subpath from the URL, or from the
  // `path` query param some rewrites produce, and fall back per method.
  const url = new URL(req.url)
  const params = url.searchParams
  const qp = params.get("path")
  let sub = url.pathname.replace(/^\/api\/llm/, "")
  if (!sub && qp) sub = `/${qp.replace(/^\/+/, "")}`
  if (qp) params.delete("path")
  if (!sub || sub === "/") sub = req.method === "GET" ? "/models" : "/chat/completions"

  const search = params.toString()
  const upstreamUrl = `${UPSTREAM}${sub}${search ? `?${search}` : ""}`

  // BYOK (in-app Settings) wins; otherwise the server key.
  const byok = req.headers.get("x-api-key")
  const serverKey = process.env.ZHIPU_API_KEY
  const auth = byok ? `Bearer ${byok}` : serverKey ? `Bearer ${serverKey}` : null

  if (!auth) {
    return new Response(
      JSON.stringify({
        error: "No LLM key available. Configure ZHIPU_API_KEY in Vercel, or set your own key in the app's Settings dialog.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )
  }

  const init: RequestInit = {
    method: req.method,
    headers: {
      "Content-Type": req.headers.get("Content-Type") ?? "application/json",
      Authorization: auth,
    },
  }
  if (req.method === "POST") {
    init.body = req.body
    // @ts-expect-error — duplex is required by undici to stream a request body
    init.duplex = "half"
  }

  const upstream = await fetch(upstreamUrl, init)

  // Stream the response straight through (chat completions can be slow).
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-cache",
    },
  })
}
