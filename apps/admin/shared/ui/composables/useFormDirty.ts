import { shallowRef, computed, toRaw, isRef } from 'vue'

// Глубокое сравнение для содержимого формы. Поддерживает примитивы, plain-объекты,
// массивы, Date, Map, Set, RegExp и циклические ссылки. Этого достаточно для всего,
// что осмысленно положить в форму; остальное (Blob/File/функции/классы) формам не нужно.
//
// Важно: НЕ оборачиваем `a` (живую форму) в toRaw — иначе reactive-proxy reads
// не зарегистрируются и computed(isDirty) перестанет реагировать на Set/Map.add().
const deepEqual = (a: unknown, b: unknown, seen = new WeakMap<object, unknown>()): boolean => {
  if (Object.is(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false

  // Циклы: если уже сравнивали `a` с тем же `b` — true (доверяем спуску, который запустился раньше).
  const prev = seen.get(a as object)

  if (prev === b) return true
  seen.set(a as object, b)

  if (a instanceof Date) return b instanceof Date && a.getTime() === b.getTime()
  if (a instanceof RegExp) return b instanceof RegExp && a.source === b.source && a.flags === b.flags

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i], seen)) return false

    return true
  }

  if (a instanceof Map) {
    if (!(b instanceof Map) || a.size !== b.size) return false
    for (const [k, v] of a) if (!b.has(k) || !deepEqual(v, b.get(k), seen)) return false

    return true
  }

  if (a instanceof Set) {
    if (!(b instanceof Set) || a.size !== b.size) return false
    // Set без стабильного порядка ключей — для каждого элемента ищем совпадение в b.
    // Допустимо: формы с большими Set'ами не встречаются.
    for (const va of a) {
      let matched = false

      for (const vb of b) {
        if (deepEqual(va, vb, seen)) {
          matched = true
          break
        }
      }
      if (!matched) return false
    }

    return true
  }

  if (Array.isArray(b) || b instanceof Date || b instanceof Map || b instanceof Set || b instanceof RegExp) {
    return false
  }

  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)

  if (ka.length !== kb.length) return false
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false
    if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], seen)) return false
  }

  return true
}

// Глубокий клон со снятием reactive-обёрток. Нужен для снапшота — он не должен
// меняться вместе с формой. structuredClone не годится: давится на reactive-proxy
// и теряет рефы.
const rawClone = <T>(v: T): T => {
  const seen = new WeakMap<object, unknown>()
  const walk = (x: unknown): unknown => {
    if (x === null || typeof x !== 'object') return x

    const raw = isRef(x) ? (x as { value: unknown }).value : toRaw(x as object)

    if (seen.has(raw as object)) return seen.get(raw as object)
    if (raw instanceof Date) return new Date(raw.getTime())
    if (raw instanceof RegExp) return new RegExp(raw.source, raw.flags)

    if (Array.isArray(raw)) {
      const out: unknown[] = []

      seen.set(raw, out)
      for (const item of raw) out.push(walk(item))

      return out
    }

    if (raw instanceof Map) {
      const out = new Map<unknown, unknown>()

      seen.set(raw, out)
      for (const [k, v] of raw) out.set(walk(k), walk(v))

      return out
    }

    if (raw instanceof Set) {
      const out = new Set<unknown>()

      seen.set(raw, out)
      for (const v of raw) out.add(walk(v))

      return out
    }

    const out: Record<string, unknown> = {}

    seen.set(raw as object, out)
    for (const k of Object.keys(raw as object)) {
      out[k] = walk((raw as Record<string, unknown>)[k])
    }

    return out
  }

  return walk(v) as T
}

export const useFormDirty = <T extends object>(form: T) => {
  const snapshot = shallowRef<unknown>(rawClone(form))
  const isDirty = computed(() => !deepEqual(form, snapshot.value))
  const reset = () => {
    snapshot.value = rawClone(form)
  }

  return { isDirty, reset }
}
