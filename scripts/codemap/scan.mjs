#!/usr/bin/env node
/**
 * Codemap scanner — парсит исходники монорепо и складывает карты в .claude/codemap/.
 *
 * Структура: каждый проект может иметь несколько под-карт (модулей).
 * Файлы распределяются по картам функцией PROJECTS[key].assign(relPath).
 *
 * Режимы:
 *   --all                       полная регенерация всех карт (bootstrap)
 *   --project=apps/admin        пересборка всех под-карт одного проекта
 *   --staged                    пересборка проектов, затронутых git-staged TS/Vue файлами
 *   --files=a.ts,b.vue          пересборка проектов, затронутых указанными файлами
 *   --report-only               не писать карты, только посчитать undescribed
 *
 * Описания (поле purpose) пишет агент в чате — скрипт их НЕ генерирует.
 * Если у файла/символа сменился hash — purpose сбрасывается в null.
 *
 * Exit codes:
 *   0 — всё ок (нет undescribed)
 *   1 — есть файлы/символы/страницы без purpose
 *   2 — фатальная ошибка
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { PROJECTS, STYLE_PROJECTS, mapPath, getProjectForFile, getStyleProjectForFile } from './projects.mjs';
import { parseFile, fileHash, pageRelToUrl } from './parsers.mjs';
import { parseScssFile, renderStyleMd } from './scss-parser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// ------------------------- args -------------------------

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const out = { all: false, staged: false, project: null, files: null, reportOnly: false };
  for (const a of argv) {
    if (a === '--all') out.all = true;
    else if (a === '--staged') out.staged = true;
    else if (a === '--report-only') out.reportOnly = true;
    else if (a.startsWith('--project=')) out.project = a.slice(10);
    else if (a.startsWith('--files=')) out.files = a.slice(8).split(',').filter(Boolean);
  }
  return out;
}

// ------------------------- fs helpers -------------------------

const SRC_EXT = new Set(['.ts', '.tsx', '.vue']);
const SKIP_DIRS = new Set(['node_modules', '.nuxt', '.output', '.turbo', '.vercel', 'dist']);

function walk(absRoot, exclude = []) {
  const out = [];
  if (!fs.existsSync(absRoot)) return out;
  const skipNames = new Set(exclude);
  const stack = [absRoot];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (ent.name.startsWith('.DS_Store')) continue;
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        if (skipNames.has(ent.name)) continue;
        stack.push(full);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name);
        if (!SRC_EXT.has(ext)) continue;
        if (ent.name.endsWith('.test.ts') || ent.name.endsWith('.spec.ts')) continue;
        if (ent.name.endsWith('.d.ts')) continue;
        out.push(full);
      }
    }
  }
  return out.sort();
}

function loadJson(absPath) {
  try { return JSON.parse(fs.readFileSync(absPath, 'utf8')); } catch { return null; }
}

function saveJson(absPath, data) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ------------------------- structures -------------------------

function newSubmap(projectKey, submap) {
  return {
    project: projectKey,
    submap,
    purpose: null,           // описание модуля (агент может заполнить)
    generated_at: new Date().toISOString(),
    stats: { files: 0, pages: 0, symbols: 0, undescribed_files: 0, undescribed_pages: 0, undescribed_symbols: 0 },
    files: {},
    pages: {},
    folders: {},
  };
}

function recomputeStats(map) {
  let files = 0, pages = 0, symbols = 0;
  let uf = 0, up = 0, us = 0;
  for (const f of Object.values(map.files)) {
    files++;
    if (f.purpose == null) uf++;
    for (const s of f.symbols ?? []) {
      symbols++;
      if (s.purpose == null) us++;
    }
  }
  for (const p of Object.values(map.pages)) {
    pages++;
    if (p.purpose == null) up++;
  }
  // folders считаются как «файлы» для целей undescribed
  for (const fld of Object.values(map.folders)) {
    files++;
    if (fld.purpose == null) uf++;
  }
  map.stats = { files, pages, symbols, undescribed_files: uf, undescribed_pages: up, undescribed_symbols: us };
}

// ------------------------- file processing -------------------------

function readPrev(projectKey, submap) {
  return loadJson(path.join(ROOT, mapPath(projectKey, submap))) ?? { files: {}, pages: {}, folders: {} };
}

function processSourceFile(abs, projectKey, projectAbs, cfg, prevs, maps) {
  const relFromProject = path.relative(projectAbs, abs).replace(/\\/g, '/');
  const submap = cfg.assign(relFromProject);
  if (submap == null) return; // файл намеренно не картируется
  if (!cfg.maps.includes(submap)) {
    process.stderr.write(`[codemap] WARN ${projectKey}/${relFromProject} → unknown submap '${submap}'\n`);
    return;
  }
  const targetSubmap = submap;
  const map = maps[targetSubmap] ?? (maps[targetSubmap] = newSubmap(projectKey, targetSubmap));
  const prev = prevs[targetSubmap] ?? (prevs[targetSubmap] = readPrev(projectKey, targetSubmap));

  let parsed;
  try { parsed = parseFile(abs); }
  catch (err) {
    parsed = { hash: 'err', kind: 'error', symbols: [{ name: '<parse-error>', kind: 'error', signature: err.message, hash: 'err' }] };
  }

  const prevFile = prev.files?.[relFromProject];
  const filePurpose = prevFile?.hash === parsed.hash ? prevFile.purpose : null;

  // символы: переиспользуем purpose если symbol-hash совпал
  const prevSymbols = new Map((prevFile?.symbols ?? []).map((s) => [s.name + ':' + s.hash, s.purpose]));
  const symbols = parsed.symbols.map((s) => ({
    name: s.name,
    kind: s.kind,
    hash: s.hash,
    purpose: prevSymbols.get(s.name + ':' + s.hash) ?? null,
  }));

  map.files[relFromProject] = {
    kind: parsed.kind,
    hash: parsed.hash,
    purpose: filePurpose,
    symbols,
  };
}

function processPageFile(abs, projectKey, projectAbs, pagesRoot, cfg, prevs, maps) {
  const relFromProject = path.relative(projectAbs, abs).replace(/\\/g, '/');
  const submap = cfg.assign(relFromProject);
  if (submap == null) return;
  if (!cfg.maps.includes(submap)) return;
  const targetSubmap = submap;
  const map = maps[targetSubmap] ?? (maps[targetSubmap] = newSubmap(projectKey, targetSubmap));
  const prev = prevs[targetSubmap] ?? (prevs[targetSubmap] = readPrev(projectKey, targetSubmap));

  const content = fs.readFileSync(abs, 'utf8');
  const h = fileHash(content);
  const url = pageRelToUrl(path.relative(pagesRoot, abs).replace(/\\/g, '/'));
  const prevPage = prev.pages?.[relFromProject];
  const purpose = prevPage?.hash === h ? prevPage.purpose : null;
  map.pages[relFromProject] = { url, hash: h, purpose };
}

function processFolderOnly(absDir, projectKey, projectAbs, mapTo, cfg, prevs, maps) {
  const relFromProject = path.relative(projectAbs, absDir).replace(/\\/g, '/');
  const targetSubmap = cfg.maps.includes(mapTo) ? mapTo : 'core';
  const map = maps[targetSubmap] ?? (maps[targetSubmap] = newSubmap(projectKey, targetSubmap));
  const prev = prevs[targetSubmap] ?? (prevs[targetSubmap] = readPrev(projectKey, targetSubmap));

  const files = walk(absDir);
  const prevFolder = prev.folders?.[relFromProject];
  map.folders[relFromProject] = {
    file_count: files.length,
    purpose: prevFolder?.purpose ?? null,
  };
}

// ------------------------- per-project scan -------------------------

function scanProject(projectKey, options = {}) {
  const cfg = PROJECTS[projectKey];
  if (!cfg) throw new Error(`Unknown project: ${projectKey}`);
  const projectAbs = path.join(ROOT, projectKey);
  if (!fs.existsSync(projectAbs)) {
    process.stderr.write(`[codemap] skip ${projectKey} (no dir)\n`);
    return [];
  }

  // prepare structures
  const maps = {};
  const prevs = {};
  for (const key of cfg.maps) {
    maps[key] = newSubmap(projectKey, key);
    prevs[key] = readPrev(projectKey, key);
  }

  // sources (regular code files)
  for (const src of cfg.sources ?? []) {
    const absDir = path.join(projectAbs, src.dir);
    const files = walk(absDir, src.exclude ?? []);
    for (const abs of files) processSourceFile(abs, projectKey, projectAbs, cfg, prevs, maps);
  }

  // pages
  for (const pr of cfg.pagesRoots ?? []) {
    const absDir = path.join(projectAbs, pr.dir);
    const files = walk(absDir);
    for (const abs of files) processPageFile(abs, projectKey, projectAbs, absDir, cfg, prevs, maps);
  }

  // folders-only
  for (const fo of cfg.foldersOnly ?? []) {
    const absDir = path.join(projectAbs, fo.dir);
    if (fs.existsSync(absDir)) {
      processFolderOnly(absDir, projectKey, projectAbs, fo.mapTo, cfg, prevs, maps);
    }
  }

  // perserve sub-map purpose if any
  for (const key of cfg.maps) {
    const prev = prevs[key];
    if (prev?.purpose) maps[key].purpose = prev.purpose;
  }

  // stats + write
  const writtenMaps = [];
  for (const key of cfg.maps) {
    const map = maps[key];
    recomputeStats(map);
    // если карта пустая — не пишем (но удалить старую если была — не будем, оставим как «пустой»)
    if (map.stats.files === 0 && map.stats.pages === 0) continue;
    if (!options.reportOnly) saveJson(path.join(ROOT, mapPath(projectKey, key)), map);
    writtenMaps.push(map);
  }
  return writtenMaps;
}

// ------------------------- styles -------------------------

function walkScss(absRoot) {
  const out = [];
  if (!fs.existsSync(absRoot)) return out;
  const stack = [absRoot];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (ent.name.startsWith('.DS_Store')) continue;
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        stack.push(full);
      } else if (ent.isFile()) {
        if (path.extname(ent.name) === '.scss') out.push(full);
      }
    }
  }
  return out.sort();
}

function scanStyleProject(projectKey) {
  const cfg = STYLE_PROJECTS[projectKey];
  if (!cfg) throw new Error(`Unknown style project: ${projectKey}`);
  const projectAbs = path.join(ROOT, projectKey);
  if (!fs.existsSync(projectAbs)) return null;

  const fileEntries = [];
  for (const src of cfg.sources ?? []) {
    const absDir = path.join(projectAbs, src.dir);
    const files = walkScss(absDir);
    for (const abs of files) {
      const relFromProject = path.relative(projectAbs, abs).replace(/\\/g, '/');
      try {
        const parsed = parseScssFile(abs);
        fileEntries.push({ relPath: relFromProject, parsed });
      } catch (err) {
        process.stderr.write(`[codemap] WARN scss parse ${projectKey}/${relFromProject}: ${err.message}\n`);
      }
    }
  }
  if (fileEntries.length === 0) return null;

  const { md, totals } = renderStyleMd(projectKey, cfg.label, fileEntries);
  const outAbs = path.join(ROOT, cfg.output);

  // Если в SCSS-файлах нет ни одного объявления (только импорты/правила) — карта бесполезна
  const declCount = totals.tokens + totals.vars + totals.mixins + totals.functions;
  if (declCount === 0) {
    if (fs.existsSync(outAbs)) fs.unlinkSync(outAbs);
    return null;
  }

  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, md + '\n', 'utf8');

  return { projectKey, output: cfg.output, totals, fileCount: fileEntries.length };
}

function scanAllStyles() {
  const results = [];
  for (const key of Object.keys(STYLE_PROJECTS)) {
    process.stderr.write(`scan styles ${key} ... `);
    const t0 = Date.now();
    const r = scanStyleProject(key);
    if (r) {
      const t = r.totals;
      process.stderr.write(`${r.fileCount} files, tokens:${t.tokens}, vars:${t.vars}, mixins:${t.mixins}, functions:${t.functions} (${Date.now() - t0}ms)\n`);
      results.push(r);
    } else {
      process.stderr.write(`(пусто, скип)\n`);
    }
  }
  return results;
}

// ------------------------- index -------------------------

function rebuildIndex() {
  const indexPath = path.join(ROOT, '.claude/codemap/index.json');
  const projects = {};
  let totFiles = 0, totSymbols = 0, totUndescr = 0;

  for (const [projKey, cfg] of Object.entries(PROJECTS)) {
    const submaps = {};
    let pf = 0, ps = 0, pu = 0;
    for (const key of cfg.maps) {
      const mp = mapPath(projKey, key);
      const map = loadJson(path.join(ROOT, mp));
      if (!map) continue;
      const st = map.stats;
      submaps[key] = {
        file: mp,
        purpose: map.purpose ?? null,
        files: st.files,
        symbols: st.symbols,
        pages: st.pages,
        undescribed: st.undescribed_files + st.undescribed_pages + st.undescribed_symbols,
      };
      pf += st.files;
      ps += st.symbols;
      pu += st.undescribed_files + st.undescribed_pages + st.undescribed_symbols;
    }
    projects[projKey] = {
      purpose: cfg.purpose,
      stats: { files: pf, symbols: ps, undescribed: pu },
      maps: submaps,
    };
    totFiles += pf; totSymbols += ps; totUndescr += pu;
  }

  // Стилевые карты — отдельный реестр
  const styles = {};
  for (const [styleKey, styleCfg] of Object.entries(STYLE_PROJECTS)) {
    const stylePath = path.join(ROOT, styleCfg.output);
    if (fs.existsSync(stylePath)) {
      styles[styleKey] = { file: styleCfg.output, label: styleCfg.label };
    }
  }

  const index = {
    rule: [
      'Это индекс карт проектов монорепо. Сами карты НЕ в контексте — Read только нужные.',
      '1. Когда юзер ставит задачу — определи затронутый проект (apps/admin, packages/shared и т.д.)',
      '2. Прочитай core-карту проекта (если есть) + субкарту нужного модуля',
      '3. Если по ходу работы выяснилось, что нужно править другой проект — СНАЧАЛА прочитай его карты, потом меняй код',
      '4. НЕ читай карты «на всякий случай» — это перегружает контекст',
      '5. Карта говорит ЧТО есть и ДЛЯ ЧЕГО. Сигнатуры/реализацию смотри в самом файле, когда нужно',
      '6. При работе со стилями (.scss / <style> в .vue) — Read нужную styles-карту из секции "styles" ниже. ВСЕГДА используй существующие токены/миксины вместо хардкода значений.',
    ].join(' '),
    generated_at: new Date().toISOString(),
    totals: { files: totFiles, symbols: totSymbols, undescribed: totUndescr },
    projects,
    styles,
  };
  saveJson(indexPath, index);
}

// ------------------------- runtime -------------------------

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: ROOT, encoding: 'utf8',
    });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (err) {
    process.stderr.write(`Failed to read git staged files: ${err.message}\n`);
    return [];
  }
}

function projectsForFiles(filePaths) {
  const set = new Set();
  for (const f of filePaths) {
    const ext = path.extname(f);
    if (!SRC_EXT.has(ext)) continue;
    const proj = getProjectForFile(f);
    if (proj && PROJECTS[proj]) set.add(proj);
  }
  return [...set];
}

function styleProjectsForFiles(filePaths) {
  const set = new Set();
  for (const f of filePaths) {
    if (path.extname(f) !== '.scss') continue;
    const proj = getStyleProjectForFile(f);
    if (proj && STYLE_PROJECTS[proj]) set.add(proj);
  }
  return [...set];
}

function decideTargets() {
  if (args.project) return [args.project];
  if (args.all) return Object.keys(PROJECTS);
  if (args.staged) return projectsForFiles(getStagedFiles());
  if (args.files) return projectsForFiles(args.files);
  return [];
}

function decideStyleTargets() {
  if (args.project) {
    return STYLE_PROJECTS[args.project] ? [args.project] : [];
  }
  if (args.all) return Object.keys(STYLE_PROJECTS);
  if (args.staged) return styleProjectsForFiles(getStagedFiles());
  if (args.files) return styleProjectsForFiles(args.files);
  return [];
}

function reportUndescribed(allMaps) {
  const fileEntries = [];
  const pageEntries = [];
  const symbolEntries = [];

  for (const map of allMaps) {
    const where = `${map.project}/${map.submap}`;
    for (const [rel, file] of Object.entries(map.files)) {
      if (file.purpose == null) fileEntries.push(`${where}  ${rel}`);
      for (const s of file.symbols ?? []) {
        if (s.purpose == null) symbolEntries.push(`${where}  ${rel}::${s.name}`);
      }
    }
    for (const [rel, page] of Object.entries(map.pages)) {
      if (page.purpose == null) pageEntries.push(`${where}  ${rel}  [${page.url}]`);
    }
    for (const [rel, fld] of Object.entries(map.folders)) {
      if (fld.purpose == null) fileEntries.push(`${where}  ${rel}/  [folder]`);
    }
  }
  return { fileEntries, pageEntries, symbolEntries };
}

function main() {
  const targets = decideTargets();
  const styleTargets = decideStyleTargets();
  if (targets.length === 0 && styleTargets.length === 0) {
    if (args.staged || args.files) process.exit(0);
    process.stderr.write('Usage: node scan.mjs [--all|--staged|--project=KEY|--files=a.ts,b.vue] [--report-only]\n');
    process.exit(2);
  }

  const allMaps = [];
  for (const key of targets) {
    process.stderr.write(`scan ${key} ... `);
    const t0 = Date.now();
    const written = scanProject(key, { reportOnly: args.reportOnly });
    const totals = written.reduce((a, m) => ({
      f: a.f + m.stats.files, s: a.s + m.stats.symbols, p: a.p + m.stats.pages,
      u: a.u + m.stats.undescribed_files + m.stats.undescribed_pages + m.stats.undescribed_symbols,
    }), { f: 0, s: 0, p: 0, u: 0 });
    process.stderr.write(`${written.length} maps, ${totals.f} files, ${totals.p} pages, ${totals.s} symbols, ${totals.u} undescribed (${Date.now() - t0}ms)\n`);
    allMaps.push(...written);
  }

  // Стили (.scss). Описаний для них не требуем — это TOC-таблица; Hook не блокируется.
  if (!args.reportOnly) {
    for (const key of styleTargets) {
      process.stderr.write(`scan styles ${key} ... `);
      const t0 = Date.now();
      const r = scanStyleProject(key);
      if (r) {
        const t = r.totals;
        process.stderr.write(`${r.fileCount} files, tokens:${t.tokens}, vars:${t.vars}, mixins:${t.mixins}, fn:${t.functions} (${Date.now() - t0}ms)\n`);
      } else {
        process.stderr.write(`(пусто)\n`);
      }
    }
  }

  if (!args.reportOnly) rebuildIndex();

  const u = reportUndescribed(allMaps);
  const total = u.fileEntries.length + u.pageEntries.length + u.symbolEntries.length;
  if (total > 0) {
    process.stderr.write(`\n=== Codemap: нет описаний ===\n`);
    process.stderr.write(`Опиши назначение каждой записи (1 строка по-русски) в поле "purpose" соответствующей карты в .claude/codemap/.\n\n`);
    if (u.fileEntries.length) {
      process.stderr.write(`-- Файлы (${u.fileEntries.length}):\n`);
      for (const x of u.fileEntries.slice(0, 30)) process.stderr.write(`  • ${x}\n`);
      if (u.fileEntries.length > 30) process.stderr.write(`  ... и ещё ${u.fileEntries.length - 30}\n`);
    }
    if (u.pageEntries.length) {
      process.stderr.write(`-- Страницы (${u.pageEntries.length}):\n`);
      for (const x of u.pageEntries.slice(0, 20)) process.stderr.write(`  • ${x}\n`);
      if (u.pageEntries.length > 20) process.stderr.write(`  ... и ещё ${u.pageEntries.length - 20}\n`);
    }
    if (u.symbolEntries.length) {
      process.stderr.write(`-- Символы (${u.symbolEntries.length}):\n`);
      for (const x of u.symbolEntries.slice(0, 30)) process.stderr.write(`  • ${x}\n`);
      if (u.symbolEntries.length > 30) process.stderr.write(`  ... и ещё ${u.symbolEntries.length - 30}\n`);
    }
    process.exit(1);
  }

  process.exit(0);
}

main();
