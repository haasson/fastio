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

  // ─── 1. codemap scan ──────────────────────────────────────────────
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
      process.stderr.write(`[codemap] git add codemap warning: ${err.message}\n`);
    }
  }

  // ─── 2. features manifests valid + AGENTS.md present ─────────────
  // Запускаем только если в стейдже есть что-то под apps/admin/features/
  let stagedFeatures = '';
  try {
    stagedFeatures = execSync('git diff --cached --name-only --diff-filter=ACMR -- apps/admin/features/', {
      cwd: ROOT, encoding: 'utf8',
    });
  } catch {
    // best-effort, если не удалось — пропускаем
  }
  if (stagedFeatures.trim()) {
    // 2a. Manifest validation + auto-fix db.tables/rpc
    try {
      execSync('node scripts/features/validate-manifests.mjs --auto-fix', {
        cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'],
      });
      // Стейджим только реально изменённые автофиксом манифесты (не все подряд).
      try {
        const dirty = execSync(
          'git diff --name-only -- "apps/admin/features/*/feature.manifest.ts"',
          { cwd: ROOT, encoding: 'utf8' },
        ).trim();
        if (dirty) {
          for (const f of dirty.split('\n')) {
            execSync(`git add "${f}"`, { cwd: ROOT, stdio: 'inherit' });
          }
        }
      } catch {}
    } catch (err) {
      if (err.status === 1) {
        process.stderr.write('\n[features] Манифесты содержат ошибки. Поправь и снова запусти git commit. Подсказки: `pnpm features:validate`\n');
        return process.exit(2);
      }
      process.stderr.write(`[features] validate failed: ${err.message}\n`);
      return process.exit(2);
    }

    // 2b. Barrel staleness check (только для авто-генерируемых barrel'ов).
    // Не блокирует если barrel ручной — там у нас маркер не стоит.
    try {
      execSync('node scripts/features/gen-barrels.mjs --check', {
        cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'],
      });
    } catch (err) {
      if (err.status === 1) {
        process.stderr.write('\n[features] Barrel index.ts устарел. Прогони `pnpm features:gen-barrels` или добавь файл в barrel вручную.\n');
        return process.exit(2);
      }
      process.stderr.write(`[features] gen-barrels check failed: ${err.message}\n`);
      return process.exit(2);
    }
  }

  // ─── 3. storefront features manifests valid + AGENTS.md present ──
  let stagedStorefrontFeatures = '';
  try {
    stagedStorefrontFeatures = execSync('git diff --cached --name-only --diff-filter=ACMR -- apps/storefront/features/', {
      cwd: ROOT, encoding: 'utf8',
    });
  } catch {
    // best-effort
  }
  if (stagedStorefrontFeatures.trim()) {
    try {
      execSync('node scripts/storefront-features/validate-manifests.mjs --auto-fix', {
        cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'],
      });
      // Стейджим только реально изменённые автофиксом манифесты.
      try {
        const dirty = execSync(
          'git diff --name-only -- "apps/storefront/features/*/feature.manifest.ts"',
          { cwd: ROOT, encoding: 'utf8' },
        ).trim();
        if (dirty) {
          for (const f of dirty.split('\n')) {
            execSync(`git add "${f}"`, { cwd: ROOT, stdio: 'inherit' });
          }
        }
      } catch {}
    } catch (err) {
      if (err.status === 1) {
        process.stderr.write('\n[storefront-features] Манифесты содержат ошибки. Поправь и снова запусти git commit. Подсказки: `pnpm storefront-features:validate`\n');
        return process.exit(2);
      }
      process.stderr.write(`[storefront-features] validate failed: ${err.message}\n`);
      return process.exit(2);
    }
  }

  process.exit(0);
});
