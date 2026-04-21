import { useStorage } from 'nitropack/runtime'
import { KB_ROUTES } from '@fastio/kb'

let cachedAiFiles: Map<string, string> | null = null
let cachedKbFiles: Map<string, string> | null = null

async function loadStorageFiles(storageName: string): Promise<Map<string, string>> {
  const storage = useStorage(storageName)
  const keys = (await storage.getKeys()).filter((k: string) => k.endsWith('.md')).sort()
  const result = new Map<string, string>()

  await Promise.all(
    keys.map(async (k: string) => {
      const content = await storage.getItem<string>(k)

      if (typeof content === 'string') {
        result.set(k, content)
      }
    }),
  )

  return result
}

async function loadAiFiles(): Promise<Map<string, string>> {
  if (!cachedAiFiles) cachedAiFiles = await loadStorageFiles('ai-knowledge')

  return cachedAiFiles
}

async function loadKbFiles(): Promise<Map<string, string>> {
  if (!cachedKbFiles) cachedKbFiles = await loadStorageFiles('kb')

  return cachedKbFiles
}

export async function loadKnowledge(currentRoute?: string): Promise<string> {
  const [aiFiles, kbFiles] = await Promise.all([loadAiFiles(), loadKbFiles()])

  const matched = currentRoute
    ? KB_ROUTES.find((r) => currentRoute.startsWith(r.route))
    : null

  const parts: string[] = []

  if (matched) {
    const relevantAiKeys = new Set(['_intro.md', '_links.md', ...matched.aiSections.map((s) => `${s}.md`)])

    for (const [key, content] of aiFiles) {
      if (relevantAiKeys.has(key)) parts.push(content)
    }

    if (matched.kbFilePrefix) {
      for (const [key, content] of kbFiles) {
        if (key.startsWith(matched.kbFilePrefix)) parts.push(content)
      }
    }
  } else {
    parts.push(...Array.from(aiFiles.values()))
    parts.push(...Array.from(kbFiles.values()))
  }

  return parts.join('\n\n')
}
