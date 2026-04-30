#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook.
 * Перехватывает вызовы Bash с командой `git commit ...` и:
 *   1. Запускает codemap scan на staged файлах
 *   2. Если есть символы без описания — блокирует коммит (exit 2)
 *   3. Если всё ок — добавляет обновлённые карты в стейдж и пропускает коммит
 *
 * stdin (JSON): { tool_name, tool_input: { command, ... }, ... }
 * exit codes:
 *   0 — пропустить tool вызов
 *   2 — блок + stderr доходит до агента
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

let stdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { stdin += d; });
process.stdin.on('end', () => {
  let payload;
  try { payload = JSON.parse(stdin); } catch { return process.exit(0); }

  if (payload.tool_name !== 'Bash') return process.exit(0);
  const cmd = payload.tool_input?.command ?? '';
  if (!/\bgit\s+commit\b/.test(cmd)) return process.exit(0);

  // запускаем scan на staged файлах
  let scanOk = true;
  try {
    execSync('node scripts/codemap/scan.mjs --staged', {
      cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'],
    });
  } catch (err) {
    scanOk = false;
    if (err.status === 1) {
      process.stderr.write('\n[codemap] Перед коммитом дозаполни поле "purpose" в указанных файлах в .claude/codemap/ и снова запусти git commit.\n');
      return process.exit(2);
    }
    process.stderr.write(`[codemap] scan failed: ${err.message}\n`);
    return process.exit(2);
  }

  if (scanOk) {
    try {
      execSync('git add .claude/codemap/', { cwd: ROOT, stdio: 'inherit' });
    } catch (err) {
      // не критично, не блокируем
      process.stderr.write(`[codemap] git add codemap warning: ${err.message}\n`);
    }
  }
  process.exit(0);
});
