#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook.
 * Срабатывает после Read и пишет в stdout сигнал, если был прочитан файл из .claude/codemap/.
 * Цель: юзер видит, что агент действительно загружает карты, а не игнорирует их.
 *
 * stdin (JSON): { tool_name, tool_input: { file_path }, tool_response, ... }
 * exit 0 всегда — мы не блокируем, только информируем.
 */

let stdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { stdin += d; });
process.stdin.on('end', () => {
  let payload;
  try { payload = JSON.parse(stdin); } catch { return process.exit(0); }

  if (payload.tool_name !== 'Read') return process.exit(0);

  const filePath = payload.tool_input?.file_path ?? '';
  const m = filePath.match(/\.claude\/codemap\/(.+)$/);
  if (!m) return process.exit(0);

  process.stdout.write(`📋 [codemap] загружена карта: ${m[1]}\n`);
  process.exit(0);
});
