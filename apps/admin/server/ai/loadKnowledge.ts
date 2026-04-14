import { useStorage } from 'nitropack/runtime'

let cachedFiles: Map<string, string> | null = null

const ROUTE_TO_KB: Record<string, string[]> = {
  '/dashboard': ['dashboard'],
  '/menu': ['menu'],
  '/orders': ['orders'],
  '/kitchen': ['kitchen'],
  '/tables': ['tables'],
  '/reservations': ['reservations'],
  '/promotions': ['promotions'],
  '/team': ['team'],
  '/content': ['content'],
  '/appearance': ['appearance'],
  '/settings': ['settings'],
  '/account': ['account'],
  '/help': ['support'],
}

async function loadAllFiles(): Promise<Map<string, string>> {
  if (cachedFiles) return cachedFiles

  const storage = useStorage('assets:ai-knowledge')
  const keys = (await storage.getKeys()).filter((k: string) => k.endsWith('.md')).sort()

  cachedFiles = new Map()

  await Promise.all(
    keys.map(async (k: string) => {
      const content = await storage.getItem<string>(k)

      if (typeof content === 'string') {
        cachedFiles!.set(k, content)
      }
    }),
  )

  return cachedFiles
}

export async function loadKnowledge(currentRoute?: string): Promise<string> {
  const files = await loadAllFiles()

  const matchedSection = currentRoute
    ? Object.entries(ROUTE_TO_KB).find(([prefix]) => currentRoute.startsWith(prefix))?.[1]
    : null

  if (matchedSection) {
    const relevantKeys = new Set(['_intro.md', '_links.md', ...matchedSection.map((s) => `${s}.md`)])
    const parts: string[] = []

    for (const [key, content] of files) {
      if (relevantKeys.has(key)) {
        parts.push(content)
      }
    }

    return parts.join('\n\n')
  }

  return Array.from(files.values()).join('\n\n')
}
