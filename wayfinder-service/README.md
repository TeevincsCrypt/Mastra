# wayfinder-service

A minimal, persistent deployment of the **official, unmodified**
[`WayfinderFoundation/wayfinder-paths-sdk`](https://github.com/WayfinderFoundation/wayfinder-paths-sdk)
MCP server, run in its officially-supported `streamable-http` transport mode
so Mastra (on Vercel) can reach it over the network. Mastra's Vercel
functions can't run a persistent Python process themselves, so this needs
its own small always-on host.

**What this does and does not do:**
- Exposes the SDK's real `onchain_quote_swap` tool (read-only routing/quote
  data from Wayfinder's actual API) over HTTP.
- Never calls `onchain_swap`, `onchain_send`, or anything that signs or
  broadcasts a transaction. Wayfinder is the routing/decision layer only —
  KeeperHub remains the sole executor.
- Holds **no private key**. `config.json` has one watch-only wallet entry
  (a well-known placeholder address, not tied to any key material) — that's
  sufficient for `onchain_quote_swap` to resolve a route; signing-related
  code paths that would need a real key are simply never invoked.

## Deploy (Railway, Render, or Fly — any works; Railway is the most
straightforward for a single Dockerfile)

### Railway
1. New Project → Deploy from GitHub repo → point it at this `Mastra` repo,
   set **Root Directory** to `wayfinder-service`.
2. Railway will detect the `Dockerfile` and build it automatically.
3. Add an environment variable: `WAYFINDER_API_KEY` = your real key from
   https://strategies.wayfinder.ai/ (connect a wallet there, create an API
   key — same self-serve pattern as KeeperHub's).
4. Deploy. Railway assigns a public URL and a `$PORT` — the Dockerfile
   already wires the SDK's `--port` to whatever Railway provides.
5. Copy the deployed URL (e.g. `https://wayfinder-service-production.up.railway.app`).
   The MCP endpoint is that URL's root (streamable-http serves at `/`).

### Render / Fly
Same shape: point either at this `wayfinder-service` directory as the build
context/root, they'll pick up the `Dockerfile`, set `WAYFINDER_API_KEY` as
an environment variable, deploy, and copy the resulting public URL.

## Wire it into Mastra

In Vercel → your Mastra project → Settings → Environment Variables, add:

```
WAYFINDER_MCP_URL=https://<your-deployed-service-url>
```

Mastra's server-side MCP client (`src/lib/wayfinder/client.ts`) connects to
this URL. `WAYFINDER_API_KEY` itself lives only in this service's own
environment (Railway/Render/Fly) — Mastra never sees it and doesn't need to.

## Security note

This service has no authentication of its own layered on top (it's running
Wayfinder's unmodified server, not a fork with custom middleware). For a
hackathon deployment that's an accepted, disclosed limitation — anyone with
the URL could call the read-only quote tool (burning your Wayfinder API
quota, nothing worse, since execution tools are never exposed to signing).
If this needs to go further than a demo, put it behind your hosting
platform's private networking / IP allowlisting so only Mastra's Vercel
deployment can reach it.
