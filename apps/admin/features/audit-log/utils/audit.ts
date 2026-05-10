export const pickFields = <T extends Record<string, unknown>>(
  obj: T | null | undefined,
  keys: string[],
): Record<string, unknown> => {
  if (!obj) return {}
  const out: Record<string, unknown> = {}

  for (const k of keys) {
    if (k in obj) out[k] = (obj as Record<string, unknown>)[k]
  }

  return out
}
