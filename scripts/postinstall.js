#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { platform } from 'os';

function commandExists(command, args = []) {
  try {
    execFileSync(command, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const currentPlatform = platform();

console.log('LINE Desktop MCP Safe dependency check');
console.log('This hardened fork does not install software, run downloaded scripts, or modify PATH automatically.');

if (currentPlatform === 'win32') {
  if (!commandExists('where', ['autohotkey.exe'])) {
    console.error('AutoHotkey v2 was not found in PATH.');
    console.error('Install it manually from https://www.autohotkey.com/ and restart your terminal.');
    process.exit(1);
  }
  console.log('AutoHotkey detected.');
  process.exit(0);
}

if (currentPlatform === 'darwin') {
  if (!commandExists('which', ['cliclick'])) {
    console.error('cliclick was not found. Install it manually before using LINE Desktop MCP.');
    process.exit(1);
  }
  console.log('cliclick detected.');
  process.exit(0);
}

console.error(`Unsupported platform: ${currentPlatform}`);
process.exit(1);
