# LINE Desktop MCP Safe Fork

This fork is hardened for personal/local use and is **read-only by default**.

## Safe defaults

- Default transport: MCP over `stdio` only.
- No HTTP listener unless `LINE_MCP_ALLOW_HTTP=true` is explicitly set.
- HTTP mode is restricted to loopback hosts only (`127.0.0.1`, `localhost`, `::1`).
- HTTP mode always requires `LINE_MCP_HTTP_TOKEN` with at least 24 characters.
- No wildcard CORS.
- No request-header logging that could expose bearer tokens.
- Legacy unauthenticated `src/http-server.js` has been removed.
- `send_message_manual` is hidden unless `LINE_MCP_ALLOW_SEND=true`.
- `send_message_auto` is hidden unless both `LINE_MCP_ALLOW_SEND=true` and `LINE_MCP_ALLOW_AUTO_SEND=true`.
- Dependency checks never install software, download executables, or modify PATH automatically.

## Recommended Windows setup

1. Install LINE Desktop from LINE's official source and sign in yourself.
2. Install Node.js from the official Node.js source.
3. Install AutoHotkey v2 from https://www.autohotkey.com/ yourself.
4. Ensure `autohotkey.exe` is available in PATH.
5. Clone this fork and checkout the hardened branch/version.
6. Run `npm install`.
7. Start with `npm start`.

For the planned AI-community digest use case, keep all send and HTTP flags at their default `false` values.

## Optional local HTTP mode

Prefer `stdio`. If a local tool such as n8n truly requires HTTP:

1. Set `LINE_MCP_ALLOW_HTTP=true`.
2. Set a random `LINE_MCP_HTTP_TOKEN` of at least 24 characters.
3. Start with `node src/server.js --http-mode --host 127.0.0.1 --port 3000`.

Remote/LAN binding is intentionally blocked in this fork.

## Sending messages

The safest configuration is read-only. If you intentionally want the tool to prepare a message in LINE without pressing Enter, set:

`LINE_MCP_ALLOW_SEND=true`

Automatic Enter/send remains disabled. To enable it, both flags are required:

`LINE_MCP_ALLOW_SEND=true`

`LINE_MCP_ALLOW_AUTO_SEND=true`

Do not enable automatic sending for an unattended AI summarization workflow.

## Plaintext chat logs

`CHAT_LOG_ON=true` may save LINE chat text to local files. Those files can contain private conversations. Leave this disabled unless you intentionally need logs, and do not sync or commit them to public repositories.
