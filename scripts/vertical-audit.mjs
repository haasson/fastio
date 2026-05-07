#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..', 'apps/admin')
const SKIP = new Set(['node_modules', '.nuxt', '.output', 'dist', '.turbo'])

function walk(dir, rel = '') {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const next = path.join(dir, entry.name)
    const nextRel = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      out.push(...walk(next, nextRel))
    } else if (entry.isFile() && /\.(ts|vue)$/.test(entry.name)) {
      out.push(nextRel)
    }
  }
  return out
}

const FILES = walk(ROOT)

const targets = process.argv.slice(2)
if (targets.length === 0) {
  console.error('Usage: node scripts/vertical-audit.mjs <substring> [<substring>...]')
  console.error('  Печатает все файлы apps/admin, чьё содержимое включает указанные подстроки.')
  console.error('  Используется перед перемещением файла, чтобы понять кто его реально импортит.')
  process.exit(1)
}

for (const target of targets) {
  console.log(`\n=== matches for "${target}" ===`)
  let count = 0
  for (const rel of FILES) {
    const abs = path.join(ROOT, rel)
    const src = readFileSync(abs, 'utf8')
    if (src.includes(target)) {
      console.log(`  ${rel}`)
      count++
    }
  }
  console.log(`  -- ${count} file(s)`)
}
