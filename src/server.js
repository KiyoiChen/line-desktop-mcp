#!/usr/bin/env node
import 'dotenv/config';

import { execFileSync } from 'child_process';
import crypto from 'crypto';
import express from 'express';
import { platform } from 'os';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { LineAutomation } from './automation/line-automation.js';

const APP_VERSION = '1.1.2-safe.1';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function envFlag(name) {
  return String(process.env[name] || '').toLowerCase() === 'true';
}

function checkDependencies() {
  const currentPlatform = platform();

  if (currentPlatform === 'win32') {
    try {
      execFileSync('where', ['autohotkey.exe'], { stdio: 'ignore' });
    } catch {
      throw new Error(
        'AutoHotkey v2 was not found in PATH. Install it manually from https://www.autohotkey.com/ and restart your terminal. This hardened fork will not install it or modify PATH automatically.'
      );
    }
    return;
  }

  if (currentPlatform === 'darwin') {
    try {
      execFileSync('which', ['cliclick'], { stdio: 'ignore' });
    } catch {
      throw new Error(
        'cliclick was not found. Install it manually (for example with Homebrew) before starting LINE Desktop MCP. This hardened fork will not install dependencies automatically.'
      );
    }
    return;
  }

  throw new Error(`Unsupported platform: ${currentPlatform}`);
}

function historyTool(name, description) {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        chatName: {
          type: 'string',
          description: 'Name of the LINE chat/group to read',
        },
        date: {
          type: 'string',
          description: 'Date to extract history for (YYYY-MM-DD; defaults to today)',
        },
        messageLimit: {
          type: 'number',
          description: 'Maximum number of messages requested (default: 100)',
          default: 100,
        },
      },
      required: ['chatName'],
    },
  };
}

function sendTool(name, description) {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        chatName: {
          type: 'string',
          description: 'Name of the LINE chat/group',
        },
        message: {
          type: 'string',
          description: 'Message content',
        },
      },
      required: ['chatName', 'message'],
    },
  };
}

class LineDesktopMCPServer {
  constructor() {
    this.allowSend = envFlag('LINE_MCP_ALLOW_SEND');
    this.allowAutoSend = this.allowSend && envFlag('LINE_MCP_ALLOW_AUTO_SEND');

    this.server = new Server(
      {
        name: 'line-desktop-mcp-safe',
        version: APP_VERSION,
      },
      {
        capabilities: { tools: {} },
      }
    );

    this.lineAutomation = new LineAutomation();
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        historyTool(
          'get_line_chatroom_history_default',
          'Read a reasonable amount of conversation history from a specific LINE chat or group.'
        ),
        historyTool(
          'get_line_chatroom_history_long',
          'Read a larger amount of conversation history for summarization or analysis.'
        ),
        historyTool(
          'get_line_chatroom_history_short',
          'Read only the most recent conversation history for a quick check.'
        ),
      ];

      if (this.allowSend) {
        tools.push(
          sendTool(
            'send_message_manual',
            'Prepare a message in a LINE chat without pressing Enter. Sending is disabled by default and requires LINE_MCP_ALLOW_SEND=true.'
          )
        );
      }

      if (this.allowAutoSend) {
        tools.push(
          sendTool(
            'send_message_auto',
            'Immediately send a LINE message. This high-risk tool is hidden unless LINE_MCP_ALLOW_SEND=true and LINE_MCP_ALLOW_AUTO_SEND=true.'
          )
        );
      }

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_line_chatroom_history_default':
            return await this.handleHistory(args, 10);
          case 'get_line_chatroom_history_long':
            return await this.handleHistory(args, 50);
          case 'get_line_chatroom_history_short':
            return await this.handleHistory(args, 5);
          case 'send_message_manual':
            if (!this.allowSend) {
              throw new McpError(ErrorCode.MethodNotFound, 'Sending is disabled. Set LINE_MCP_ALLOW_SEND=true to enable manual send.');
            }
            return await this.handleSendMessage(args, false);
          case 'send_message_auto':
            if (!this.allowAutoSend) {
              throw new McpError(
                ErrorCode.MethodNotFound,
                'Automatic sending is disabled. Set both LINE_MCP_ALLOW_SEND=true and LINE_MCP_ALLOW_AUTO_SEND=true to enable it.'
              );
            }
            return await this.handleSendMessage(args, true);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Error executing tool ${name}: ${error.message}`);
      }
    });
  }

  async handleHistory(args, pageUpTimes) {
    const { chatName, date, messageLimit = 100 } = args;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const history = await this.lineAutomation.getChatHistory(chatName, targetDate, messageLimit, pageUpTimes);
    const historyText = (history || '').slice(-50000);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              chatName,
              date: targetDate,
              messageLimit,
              history: historyText,
              chatRoomUpdatedAt: new Date().toLocaleString(),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleSendMessage(args, autoSend) {
    const { chatName, message } = args;
    const result = await this.lineAutomation.sendChatMessage(chatName, message, autoSend);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: result.success,
              chatName,
              autoSend,
              timestamp: new Date().toISOString(),
              error: result.error || null,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async runStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`LINE Desktop MCP Safe ${APP_VERSION} running in stdio mode (read-only by default).`);
  }

  async runHttp({ port, host, token }) {
    const app = express();
    const transports = {};
    const endpoint = '/mcp';

    app.disable('x-powered-by');
    app.use(express.json({ limit: '64kb' }));

    app.use(endpoint, (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${token}`) {
        console.error(`[AUTH] Rejected MCP request from ${req.ip}`);
        return res.status(401).json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Unauthorized' },
          id: null,
        });
      }
      next();
    });

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', server: 'line-desktop-mcp-safe', version: APP_VERSION });
    });

    app.all(endpoint, async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];

      try {
        let transport;

        if (sessionId && transports[sessionId]) {
          transport = transports[sessionId];
          await transport.handleRequest(req, res, req.method === 'POST' ? req.body : null);
          return;
        }

        if (req.method !== 'POST' || req.body?.method !== 'initialize') {
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Invalid request or missing session' },
            id: null,
          });
          return;
        }

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          onsessioninitialized: (newSessionId) => {
            transports[newSessionId] = transport;
          },
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };

        transport.onerror = (error) => {
          console.error('MCP transport error:', error?.message || error);
        };

        await this.server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('MCP HTTP request failed:', error?.message || error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          });
        }
      }
    });

    app.listen(port, host, () => {
      console.error(`LINE Desktop MCP Safe ${APP_VERSION} listening on http://${host}:${port}${endpoint}`);
      console.error('HTTP mode is loopback-only and requires a bearer token.');
    });
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    httpMode: false,
    port: 3000,
    host: '127.0.0.1',
  };

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--http-mode') {
      config.httpMode = true;
    } else if (args[i] === '--port' && i + 1 < args.length) {
      config.port = Number.parseInt(args[++i], 10);
    } else if (args[i] === '--host' && i + 1 < args.length) {
      config.host = args[++i];
    }
  }

  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('Invalid --port value.');
  }

  return config;
}

async function main() {
  checkDependencies();
  const config = parseArgs();
  const server = new LineDesktopMCPServer();

  if (!config.httpMode) {
    await server.runStdio();
    return;
  }

  if (!envFlag('LINE_MCP_ALLOW_HTTP')) {
    throw new Error('HTTP mode is disabled by default. Set LINE_MCP_ALLOW_HTTP=true only if you explicitly need local HTTP access.');
  }

  if (!LOOPBACK_HOSTS.has(config.host)) {
    throw new Error('Remote HTTP binding is disabled in this hardened fork. Use 127.0.0.1, localhost, or ::1 only.');
  }

  const token = process.env.LINE_MCP_HTTP_TOKEN;
  if (!token || token.length < 24) {
    throw new Error('HTTP mode requires LINE_MCP_HTTP_TOKEN with at least 24 characters. Prefer a randomly generated secret.');
  }

  await server.runHttp({ port: config.port, host: config.host, token });
}

main().catch((error) => {
  console.error(`FATAL: ${error.message}`);
  process.exit(1);
});
