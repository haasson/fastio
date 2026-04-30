// Парсер SCSS-файлов для codemap. Извлекает:
//   - CSS custom properties (`--name: value;`)
//   - SCSS-переменные (`$name: value;`)
//   - Миксины (`@mixin name(args?) { … }`)
//   - Функции (`@function name(args?) { … }`)
//   - Однострочные комментарии `// …` перед объявлением — как описание

import fs from 'node:fs';

function truncateValue(v, max = 50) {
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function parseScssContent(content) {
  // Срезаем многострочные комментарии чтобы не мешались
  const sansBlock = content.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = sansBlock.split('\n');

  const tokens = [];     // CSS custom properties (var(--name))
  const variables = [];  // SCSS vars
  const mixins = [];
  const functions = [];

  let pendingComment = null;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === '') { pendingComment = null; continue; }

    // // comment
    const cm = trimmed.match(/^\/\/\s*(.+?)\s*$/);
    if (cm) {
      pendingComment = pendingComment ? pendingComment + ' ' + cm[1] : cm[1];
      continue;
    }

    // --name: value;
    const tm = trimmed.match(/^(--[\w-]+)\s*:\s*([^;{]+?)\s*;/);
    if (tm) {
      tokens.push({ name: tm[1], value: truncateValue(tm[2]), comment: pendingComment });
      pendingComment = null;
      continue;
    }

    // $name: value;
    const vm = trimmed.match(/^(\$[\w-]+)\s*:\s*([^;]+?)(?:\s*!default)?\s*;/);
    if (vm) {
      variables.push({ name: vm[1], value: truncateValue(vm[2]), comment: pendingComment });
      pendingComment = null;
      continue;
    }

    // @mixin name(args)? {
    const mm = trimmed.match(/^@mixin\s+([\w-]+)\s*(\([^)]*\))?\s*\{?/);
    if (mm) {
      const sig = mm[1] + (mm[2]?.replace(/\s+/g, ' ') ?? '');
      mixins.push({ name: mm[1], signature: sig, comment: pendingComment });
      pendingComment = null;
      continue;
    }

    // @function name(args)?
    const fm = trimmed.match(/^@function\s+([\w-]+)\s*(\([^)]*\))?\s*\{?/);
    if (fm) {
      const sig = fm[1] + (fm[2]?.replace(/\s+/g, ' ') ?? '');
      functions.push({ name: fm[1], signature: sig, comment: pendingComment });
      pendingComment = null;
      continue;
    }

    // Любая другая непустая строка сбрасывает pending — комментарий «не достиг» объявления
    pendingComment = null;
  }

  return { tokens, variables, mixins, functions };
}

export function parseScssFile(absPath) {
  const content = fs.readFileSync(absPath, 'utf8');
  return parseScssContent(content);
}

function fmtComment(c) { return c ? ` — ${c}` : ''; }

export function renderStyleMd(projectKey, label, fileEntries) {
  const lines = [];
  lines.push(`# Styles — \`${projectKey}\``);
  lines.push('');
  if (label) { lines.push(`> ${label}`); lines.push(''); }
  lines.push(`_Карта SCSS-токенов и миксинов проекта. Используй переменные/миксины ВСЕГДА вместо хардкода значений._`);
  lines.push('');

  let total = { tokens: 0, vars: 0, mixins: 0, functions: 0 };

  for (const { relPath, parsed } of fileEntries) {
    const has = parsed.tokens.length || parsed.variables.length || parsed.mixins.length || parsed.functions.length;
    if (!has) continue;
    lines.push(`## \`${relPath}\``);
    lines.push('');

    if (parsed.tokens.length) {
      lines.push('**CSS-токены** (`var(--name)`):');
      for (const t of parsed.tokens) {
        lines.push(`- \`${t.name}\` — \`${t.value}\`${fmtComment(t.comment)}`);
      }
      lines.push('');
      total.tokens += parsed.tokens.length;
    }
    if (parsed.variables.length) {
      lines.push('**SCSS-переменные**:');
      for (const v of parsed.variables) {
        lines.push(`- \`${v.name}\` — \`${v.value}\`${fmtComment(v.comment)}`);
      }
      lines.push('');
      total.vars += parsed.variables.length;
    }
    if (parsed.mixins.length) {
      lines.push('**Миксины**:');
      for (const m of parsed.mixins) {
        lines.push(`- \`@mixin ${m.signature}\`${fmtComment(m.comment)}`);
      }
      lines.push('');
      total.mixins += parsed.mixins.length;
    }
    if (parsed.functions.length) {
      lines.push('**Функции**:');
      for (const f of parsed.functions) {
        lines.push(`- \`@function ${f.signature}\`${fmtComment(f.comment)}`);
      }
      lines.push('');
      total.functions += parsed.functions.length;
    }
  }

  return { md: lines.join('\n'), totals: total };
}
