# Runs the OFFICIAL, unmodified WayfinderFoundation/wayfinder-paths-sdk MCP
# server in streamable-http mode so Mastra's Vercel deployment can reach it
# over the network. The repo is cloned at build time from upstream — nothing
# here forks or modifies Wayfinder's own code.
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends git curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir poetry

WORKDIR /app
RUN git clone --depth 1 https://github.com/WayfinderFoundation/wayfinder-paths-sdk.git .
RUN poetry install --no-interaction --no-ansi --no-root

# Watch-only wallet config — see config.json. No private key anywhere in
# this image: Mastra only ever calls the read-only onchain_quote_swap tool,
# never onchain_swap/onchain_send, so no wallet in this config needs
# private_key_hex (confirmed against the SDK's own wallet-loading code —
# private_key_hex is only required inside the signing callback that quote
# calls never touch).
COPY config.json /app/config.json
ENV WAYFINDER_CONFIG_PATH=/app/config.json
ENV WAYFINDER_MCP_TRANSPORT=streamable-http
ENV WAYFINDER_MCP_HOST=0.0.0.0

EXPOSE 8000

# Railway/Render/Fly inject $PORT at runtime; fall back to 8000 locally.
CMD ["sh", "-c", "WAYFINDER_MCP_PORT=${PORT:-8000} poetry run python -m wayfinder_paths.mcp.server"]
