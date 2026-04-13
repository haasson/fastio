import { useStorage } from 'nitropack/runtime'

let cachedKnowledge: string | null = null

export async function loadKnowledge(): Promise<string> {
  if (cachedKnowledge) return cachedKnowledge

  const storage = useStorage('assets:ai-knowledge')
  const keys = (await storage.getKeys()).filter((k: string) => k.endsWith('.md')).sort()

  const parts = await Promise.all(
    keys.map((k: string) => storage.getItem<string>(k)),
  )

  cachedKnowledge = parts.filter((p): p is string => typeof p === 'string').join('\n\n')

  return cachedKnowledge
}
