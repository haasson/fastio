// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMerge<T extends Record<string, any>>(defaults: T, overrides: Partial<T> | null | undefined): T {
  if (!overrides) return { ...defaults }

  const result = { ...defaults }

  for (const key in overrides) {
    const val = overrides[key]
    const def = defaults[key]

    if (val !== null && val !== undefined && typeof val === 'object' && !Array.isArray(val) && typeof def === 'object' && def !== null && !Array.isArray(def)) {
      result[key] = deepMerge(def, val as Partial<typeof def>)
    } else if (val !== undefined) {
      result[key] = val as T[typeof key]
    }
  }

  return result
}
