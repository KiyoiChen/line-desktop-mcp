# Security Policy

## Scope

This fork controls an already logged-in LINE Desktop application through GUI automation. That means any process allowed to invoke the MCP server may potentially read visible chat content and, if sending is enabled, interact with the LINE account.

## Hardened defaults

This fork intentionally uses the following defaults:

- Read-only MCP tools only.
- `stdio` transport only.
- No automatic dependency installation or PATH modification.
- No remote/LAN HTTP binding.
- Local HTTP mode is opt-in and bearer-token protected.
- Automatic message sending is opt-in behind two environment flags.
- Legacy unauthenticated HTTP code has been removed.

## Environment switches

| Variable | Default | Effect |
| --- | --- | --- |
| `LINE_MCP_ALLOW_SEND` | `false` | Exposes manual message preparation. |
| `LINE_MCP_ALLOW_AUTO_SEND` | `false` | Allows automatic Enter/send; also requires `LINE_MCP_ALLOW_SEND=true`. |
| `LINE_MCP_ALLOW_HTTP` | `false` | Enables local loopback HTTP mode. |
| `LINE_MCP_HTTP_TOKEN` | empty | Required for HTTP mode; minimum 24 characters. |
| `CHAT_LOG_ON` | `false` | Writes chat content to plaintext local files. |

## Security recommendations

- Use `stdio` unless local HTTP is strictly necessary.
- Keep all send features disabled for summarization/monitoring workflows.
- Install AutoHotkey/Node/LINE only from their official sources.
- Never expose this MCP server to `0.0.0.0`, a LAN address, port forwarding, tunnels, or the public internet.
- Never commit `.env`, tokens, chat logs, screenshots, or exported LINE conversations.
- Treat chat text as private data. If it is sent to an AI API, review that provider's data handling and avoid sending material you are not authorized to process.

## Reporting

For upstream product issues, refer to the original project at `dtwang/line-desktop-mcp`. For security changes specific to this fork, use this fork's GitHub issue tracker without posting secrets or private chat content.

## No absolute guarantee

Open-source review reduces risk but cannot prove that software is free of all vulnerabilities. Run this tool with the minimum permissions and features necessary for your use case.
