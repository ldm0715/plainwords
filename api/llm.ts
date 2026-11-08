// Vercel Edge Function: /api/llm/* → forwards to the Zhipu (GLM) endpoint.
// Injects the server-side key from the ZHIPU_API_KEY environment variable —
// the browser never sees a key in production. Optional BYOK: a client may
// send its own `x-api-key` header (set via the in-app Settings dialog), which
// takes precedence over the server key.

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

  const url = new URL(req.url)
  const upstreamUrl = `${UPSTREAM}${url.pathname.replace(/^\/api\/llm/, "")}${url.search}`

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

  const upstream = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: req.body,
    // @ts-expect-error — duplex is required by undici to stream a request body
    duplex: "half",
  })

  // Stream the response straight through (chat completions can be slow).
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-cache",
    },
  })
}
