export const pickFields = (
  obj: object | null | undefined,
  keys: string[],
): Record<string, unknown> => {
  if (!obj) return {}
  const out: Record<string, unknown> = {}
  const o = obj as Record<string, unknown>

  for (const k of keys) {
    if (k in o) out[k] = o[k]
  }

  return out
}
